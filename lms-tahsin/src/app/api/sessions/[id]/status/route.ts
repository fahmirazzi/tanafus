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
import { invoiceIssuedEmailContent, issueInvoice } from "@/lib/invoice-issuer";
import { applyCompletionEffects } from "@/lib/session-completion";
import {
  createNotifications,
  getClassAudienceIds,
  getStudentAudienceIds,
  sendEventEmail,
} from "@/lib/notifications";
import { formatTanggalJamWIB } from "@/lib/datetime";
import {
  canApplyAction,
  isBillableStatus,
  nextStatusFor,
  SESSION_ACTION_LABEL,
} from "@/lib/session-actions";
import {
  canApplyRegularAction,
  regularNextStatus,
  REGULAR_ACTION_LABEL,
  type RegularAction,
} from "@/lib/regular-sessions";
import { activeRoster } from "@/lib/class-groups";
import { isRosterComplete } from "@/lib/attendance";
import {
  findTeacherSlotConflict,
  zonedDateTimeToUtc,
  zonedDayOfWeek,
} from "@/lib/sessions";
import { TX_OPTIONS } from "@/lib/users";
import {
  SESSION_STATUS_LABEL,
  regularSessionActionSchema,
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
 *
 * Task 8 menambahkan cabang REGULER sebelum logika privat. Keduanya berbagi
 * pengambilan sesi dan pengecekan kepemilikan; setelah itu jalurnya terpisah
 * total karena aturan uangnya berbeda (BR-05.5) dan aksinya sendiri berbeda
 * (regular-sessions.ts, bukan session-actions.ts).
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
        classGroupId: true,
        teacherId: true,
        substituteTeacherId: true,
        studentId: true,
        scheduledAt: true,
        durationMinutes: true,
        student: { select: { fullName: true, billingPreference: true } },
        classGroup: { select: { name: true, honorPerSession: true } },
      },
    });
    if (!session) return apiError("Sesi tidak ditemukan", 404);

    // === CABANG REGULER ===
    if (session.type === SessionType.regular) {
      if (!session.classGroupId || !session.classGroup || !session.teacherId) {
        return apiError("Sesi ini bukan sesi kelas reguler", 422);
      }

      // Yang berhak menekan tombol adalah guru sesi itu sendiri, guru
      // pengganti, atau admin — sama seperti privat.
      const isOwnTeacher =
        user.id === session.teacherId ||
        user.id === session.substituteTeacherId;
      if (!isAdmin(user) && !isOwnTeacher) throw new ForbiddenError();

      const body: unknown = await req.json();
      const parsed = regularSessionActionSchema.safeParse(body);
      if (!parsed.success) {
        return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
      }
      const { action, notes, makeupAt } = parsed.data;
      const regularAction = action as RegularAction;

      // 1. Aksi yang sah untuk reguler berbeda (BR-02.4a: tidak ada cancel_teacher)
      if (!canApplyRegularAction(session.status, regularAction)) {
        return apiError(
          `Sesi berstatus "${SESSION_STATUS_LABEL[session.status]}" tidak bisa ditandai "${REGULAR_ACTION_LABEL[regularAction]}"`,
          422,
        );
      }

      // 2. Menyelesaikan kelas menuntut roster lengkap (spec B1 §5.3)
      if (regularAction === "complete") {
        const roster = await activeRoster(session.classGroupId);
        const marks = await prisma.sessionAttendance.findMany({
          where: { sessionId: id },
          select: { studentId: true, status: true },
        });
        if (!isRosterComplete(roster.map((r) => r.studentId), marks)) {
          return apiError(
            "Tandai kehadiran seluruh murid lebih dulu sebelum menutup kelas ini.",
            422,
          );
        }
      }

      // 3. Membatalkan kelas WAJIB disertai usulan sesi pengganti (BR-02.4)
      let makeupScheduledAt: Date | null = null;
      if (regularAction === "cancel_institution") {
        if (!makeupAt) {
          return apiError(
            "Pembatalan kelas reguler wajib disertai jadwal sesi pengganti.",
            422,
          );
        }

        const conflict = await findTeacherSlotConflict({
          teacherId: session.teacherId,
          dayOfWeek: zonedDayOfWeek(makeupAt.date),
          startTime: makeupAt.startTime,
          durationMinutes: session.durationMinutes,
          ignoreClassGroupId: session.classGroupId,
        });
        if (conflict) {
          return apiError(
            `Guru ini sudah punya ${conflict.label} pada jam yang sama. Pilih jam lain.`,
            422,
          );
        }

        makeupScheduledAt = zonedDateTimeToUtc(makeupAt.date, makeupAt.startTime);
      }

      const nextStatus = regularNextStatus(regularAction);
      const earnerId = session.substituteTeacherId ?? session.teacherId;
      const honorPerSession = Number(session.classGroup.honorPerSession);
      const previousStatus = session.status;
      const className = session.classGroup.name;
      const waktu = formatTanggalJamWIB(session.scheduledAt);
      const waktuPengganti = makeupScheduledAt
        ? formatTanggalJamWIB(makeupScheduledAt)
        : null;

      // BR-09.2: peristiwa sesi reguler menyebar ke SELURUH murid aktif
      // beserta wali, ditambah guru yang benar-benar mengajar kelas ini.
      const audience = [
        ...(await getClassAudienceIds(session.classGroupId)),
        earnerId,
      ];

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
          newData: { status: nextStatus, action: regularAction },
        });

        // BR-05.5/BR-05.6: honor guru, TANPA charge murid — biaya periode
        // sudah menutupinya. createsCharge/createsEarning di
        // regular-sessions.ts yang menentukan cabangnya; di sini tidak
        // pernah menulis SessionCharge untuk tipe reguler.
        const effects = await applyCompletionEffects(tx, {
          sessionId: id,
          type: session.type,
          nextStatus,
          actorId: user.id,
          studentId: null,
          durationMinutes: session.durationMinutes,
          earnerId,
          chargeAmount: null,
          earningAmount: honorPerSession,
        });

        let makeupSessionId: string | null = null;
        if (regularAction === "cancel_institution" && makeupScheduledAt) {
          const makeup = await tx.session.create({
            data: {
              type: SessionType.regular,
              classGroupId: session.classGroupId,
              teacherId: session.teacherId,
              scheduledAt: makeupScheduledAt,
              durationMinutes: session.durationMinutes,
              isMakeupFor: id,
            },
            select: { id: true },
          });
          makeupSessionId = makeup.id;

          await writeAudit(tx, {
            actorId: user.id,
            entity: "Session",
            entityId: makeup.id,
            action: "create_makeup",
            newData: {
              isMakeupFor: id,
              scheduledAt: makeupScheduledAt.toISOString(),
            },
          });

          // BR-09: pembatalan kelas wajib diberitahukan, sekaligus kabar
          // sesi penggantinya.
          await createNotifications(tx, {
            userIds: audience,
            type: "session_cancelled_institution",
            title: "Kelas diliburkan",
            body: `Kelas ${className} pada ${waktu} dibatalkan lembaga. Sesi pengganti dijadwalkan ${waktuPengganti}.`,
            data: { sessionId: id, makeupSessionId },
          });
        }

        return { effects, makeupSessionId };
      }, TX_OPTIONS);

      if (regularAction === "cancel_institution") {
        // BR-09: dikirim setelah transaksi commit — lihat catatan di
        // sendEventEmail kenapa tidak dari dalam transaksi.
        await sendEventEmail(audience, {
          subject: "Kelas diliburkan",
          title: "Kelas diliburkan",
          body: `Kelas ${className} pada ${waktu} dibatalkan lembaga. Sesi pengganti dijadwalkan ${waktuPengganti}.`,
        });
      }

      return apiOk({
        id,
        status: nextStatus,
        charge: null,
        earning: result.effects.earningCreated
          ? { amount: result.effects.earningAmount, created: true }
          : null,
        makeupSessionId: result.makeupSessionId,
      });
    }

    // === CABANG PRIVAT (tidak berubah dari sebelumnya) ===
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

      const effects = await applyCompletionEffects(tx, {
        sessionId: id,
        type: session.type,
        nextStatus,
        actorId: user.id,
        studentId,
        durationMinutes: session.durationMinutes,
        earnerId,
        chargeAmount: billable ? amount : null,
        earningAmount: billable ? earningAmount : 0,
      });

      let invoice: Awaited<ReturnType<typeof issueInvoice>> = null;

      if (billable) {
        // BR-04.3a: murid per_session langsung menerima invoice berisi satu
        // charge. Murid monthly_bundle menunggu cron tanggal 1.
        //
        // Chargenya dicari ulang alih-alih memakai effects.chargeCreated:
        // bila sesi ini pernah gagal ditagih karena kesalahan sesaat, jalan
        // kedua di sini menambalnya. issueInvoice sendiri menyaring charge
        // yang sudah masuk invoice, jadi pengulangan tidak melahirkan
        // tagihan kedua.
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

      return {
        chargeCreated: effects.chargeCreated,
        earningCreated: effects.earningCreated,
        invoice,
      };
    }, TX_OPTIONS);

    // BR-09: sesi diliburkan guru dan invoice yang baru terbit wajib lewat
    // email juga, dikirim di sini karena transaksi di atas sudah commit —
    // lihat catatan di sendEventEmail kenapa tidak dari dalam transaksi.
    if (action === "cancel_teacher") {
      await sendEventEmail(audience, {
        subject: "Sesi diliburkan",
        title: "Sesi diliburkan",
        body: `Sesi ${studentName} pada ${waktu} diliburkan guru. Tidak ada tagihan untuk sesi ini.`,
      });
    }
    if (result.invoice) {
      await sendEventEmail(audience, invoiceIssuedEmailContent(result.invoice));
    }

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
