import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { computeEarning, resolveSessionAmount } from "@/lib/billing";
import { issueInvoice } from "@/lib/invoice-issuer";
import {
  createNotifications,
  getStudentAudienceIds,
} from "@/lib/notifications";
import { formatTanggalJamWIB } from "@/lib/datetime";
import {
  canApplyAction,
  isBillableStatus,
  nextStatusFor,
  SESSION_ACTION_LABEL,
} from "@/lib/session-actions";
import { TX_OPTIONS } from "@/lib/users";
import {
  SESSION_STATUS_LABEL,
  sessionActionSchema,
} from "@/lib/validations/session";
import { BillingPreference, SessionType } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/** BR-05.1: bagi hasil default 60% bila guru belum punya profil. */
const DEFAULT_REVENUE_SHARE_PCT = 60;

/**
 * Tombol aksi status sesi (roadmap item 16) sekaligus pemicu tagihan dan
 * upah (roadmap item 17).
 *
 * Charge dan earning lahir di sini, di dalam satu transaksi dengan
 * perubahan status, karena BR-04.1 mengharuskan keduanya tepat sekali per
 * sesi. Idempotensinya bertumpu pada unique sessionId di kedua tabel:
 * createMany + skipDuplicates membuat klik ganda berakhir diam, bukan
 * melempar P2002 dan mengotori log dengan kejadian yang sebenarnya wajar.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        teacherId: true,
        substituteTeacherId: true,
        studentId: true,
        scheduledAt: true,
        durationMinutes: true,
        student: { select: { fullName: true, billingPreference: true } },
      },
    });
    if (!session) return apiError("Sesi tidak ditemukan", 404);
    if (
      session.type !== SessionType.private ||
      !session.teacherId ||
      !session.studentId
    ) {
      return apiError("Sesi ini bukan sesi privat", 422);
    }

    // Yang berhak menekan tombol adalah guru sesi itu sendiri, guru
    // pengganti yang benar-benar mengajarkannya, atau admin. Sengaja tidak
    // memakai assertCanScheduleFor: penugasan bisa saja sudah berakhir,
    // sementara sesi yang terlanjur dijadwalkan tetap harus bisa ditutup.
    const isOwnTeacher =
      user.id === session.teacherId || user.id === session.substituteTeacherId;
    if (!isAdmin(user) && !isOwnTeacher) throw new ForbiddenError();

    const body: unknown = await req.json();
    const parsed = sessionActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { action, notes } = parsed.data;

    if (!canApplyAction(session.status, action)) {
      return apiError(
        `Sesi berstatus "${SESSION_STATUS_LABEL[session.status]}" tidak bisa ditandai "${SESSION_ACTION_LABEL[action]}"`,
        422,
      );
    }

    const nextStatus = nextStatusFor(action);
    const billable = isBillableStatus(nextStatus);
    const studentId = session.studentId;

    // Upah mengalir ke guru pengganti bila ada (BR-04.4); murid tetap
    // ditagih dengan tarifnya sendiri.
    const earnerId = session.substituteTeacherId ?? session.teacherId;

    let amount = 0;
    let earningAmount = 0;

    if (billable) {
      const [customRate, tier, profile] = await Promise.all([
        prisma.studentCustomRate.findUnique({
          where: { studentId },
          select: { customPrice: true },
        }),
        prisma.pricingTier.findFirst({
          where: { durationMinutes: session.durationMinutes, isActive: true },
          select: { price: true },
        }),
        prisma.teacherProfile.findUnique({
          where: { userId: earnerId },
          select: { revenueSharePct: true },
        }),
      ]);

      // BR-03.4: harga di-snapshot saat sesi selesai, bukan saat dijadwalkan.
      const resolved = resolveSessionAmount({
        durationMinutes: session.durationMinutes,
        customPrice: customRate?.customPrice ?? null,
        tierPrice: tier ? Number(tier.price) : null,
      });
      if (resolved === null) {
        return apiError(
          `Belum ada tarif aktif untuk durasi ${session.durationMinutes} menit. Minta admin menambahkannya sebelum menutup sesi ini.`,
          422,
        );
      }

      amount = resolved;
      earningAmount = computeEarning(
        amount,
        profile ? Number(profile.revenueSharePct) : DEFAULT_REVENUE_SHARE_PCT,
      );
    }

    const audience = await getStudentAudienceIds(studentId);
    const previousStatus = session.status;
    const studentName = session.student?.fullName ?? "murid";
    const waktu = formatTanggalJamWIB(session.scheduledAt);

    const result = await prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(notes !== undefined
            ? { notes: notes.trim() ? notes.trim() : null }
            : {}),
        },
      });

      await writeAudit(tx, {
        actorId: user.id,
        entity: "Session",
        entityId: id,
        action: "status_change",
        oldData: { status: previousStatus },
        newData: { status: nextStatus, action },
      });

      let chargeCreated = false;
      let earningCreated = false;
      let invoice: Awaited<ReturnType<typeof issueInvoice>> = null;

      if (billable) {
        const charge = await tx.sessionCharge.createMany({
          data: [
            {
              sessionId: id,
              studentId,
              durationMinutes: session.durationMinutes,
              amount,
            },
          ],
          skipDuplicates: true,
        });
        chargeCreated = charge.count > 0;

        if (chargeCreated) {
          await writeAudit(tx, {
            actorId: user.id,
            entity: "SessionCharge",
            entityId: id,
            action: "create",
            newData: {
              amount,
              durationMinutes: session.durationMinutes,
              studentId,
            },
          });
        }

        const earning = await tx.sessionEarning.createMany({
          data: [{ sessionId: id, teacherId: earnerId, amount: earningAmount }],
          skipDuplicates: true,
        });
        earningCreated = earning.count > 0;

        if (earningCreated) {
          await writeAudit(tx, {
            actorId: user.id,
            entity: "SessionEarning",
            entityId: id,
            action: "create",
            newData: { amount: earningAmount, teacherId: earnerId },
          });
        }

        // BR-04.3a: murid per_session langsung menerima invoice berisi satu
        // charge. Murid monthly_bundle menunggu cron tanggal 1.
        //
        // Chargenya dicari ulang alih-alih memakai chargeCreated: bila sesi
        // ini pernah gagal ditagih karena kesalahan sesaat, jalan kedua di
        // sini menambalnya. issueInvoice sendiri menyaring charge yang sudah
        // masuk invoice, jadi pengulangan tidak melahirkan tagihan kedua.
        if (
          session.student?.billingPreference === BillingPreference.per_session
        ) {
          const charge = await tx.sessionCharge.findUnique({
            where: { sessionId: id },
            select: { id: true },
          });
          if (charge) {
            invoice = await issueInvoice(tx, {
              studentId,
              chargeIds: [charge.id],
              actorId: user.id,
              now: new Date(),
            });
          }
        }
      }

      // BR-09: pembatalan oleh guru wajib diberitahukan; PRD F-3a juga
      // meminta orang tua tahu ketika muridnya tercatat bolos. Sesi yang
      // selesai normal tidak diberi notifikasi sendiri — kabar itu datang
      // bersama feedback.
      if (action === "cancel_teacher") {
        await createNotifications(tx, {
          userIds: audience,
          type: "session_cancelled_teacher",
          title: "Sesi diliburkan",
          body: `Sesi ${studentName} pada ${waktu} diliburkan guru. Tidak ada tagihan untuk sesi ini.`,
          data: { sessionId: id },
        });
      } else if (action === "complete_absent") {
        await createNotifications(tx, {
          userIds: audience,
          type: "session_completed_absent",
          title: "Murid tidak hadir",
          body: `${studentName} tidak hadir pada sesi ${waktu}. Sesi ini tetap ditagih sesuai aturan lembaga.`,
          data: { sessionId: id },
        });
      }

      return { chargeCreated, earningCreated, invoice };
    }, TX_OPTIONS);

    return apiOk({
      id,
      status: nextStatus,
      charge: billable ? { amount, created: result.chargeCreated } : null,
      earning: billable
        ? { amount: earningAmount, created: result.earningCreated }
        : null,
      invoice: result.invoice,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
