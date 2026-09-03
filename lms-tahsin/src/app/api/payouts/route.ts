import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import {
  apiError,
  apiList,
  apiOk,
  parsePagination,
  toPrismaPagination,
  zodFieldErrors,
} from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  hasRole,
  isAdmin,
  requireAuth,
  requireRole,
} from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { formatRupiah } from "@/lib/currency";
import { createNotifications, getAdminUserIds } from "@/lib/notifications";
import { sumEarnings } from "@/lib/payouts";
import { payoutListQuerySchema } from "@/lib/validations/payout";
import { EarningStatus, RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const PAYOUT_SELECT = {
  id: true,
  teacherId: true,
  totalAmount: true,
  status: true,
  note: true,
  requestedAt: true,
  decidedAt: true,
  paidAt: true,
  teacher: { select: { fullName: true } },
  _count: { select: { items: true } },
};

/**
 * Daftar pengajuan payout (roadmap item 26).
 *
 * Guru hanya melihat pengajuannya sendiri — BR-10.3 melarang data keuangan
 * guru lain tampil ke siapa pun selain admin.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    if (!isAdmin(user) && !hasRole(user, RoleName.teacher)) {
      throw new ForbiddenError();
    }

    const url = new URL(req.url);
    const parsed = payoutListQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      teacherId: url.searchParams.get("teacherId") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Filter tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const where: Prisma.PayoutWhereInput = {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      // Filter teacherId dari client hanya berlaku untuk admin; guru selalu
      // dikunci ke dirinya sendiri, apa pun yang dikirim.
      ...(isAdmin(user)
        ? parsed.data.teacherId
          ? { teacherId: parsed.data.teacherId }
          : {}
        : { teacherId: user.id }),
    };

    const pagination = parsePagination(url);
    const [rows, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        select: PAYOUT_SELECT,
        orderBy: { requestedAt: "desc" },
        ...toPrismaPagination(pagination),
      }),
      prisma.payout.count({ where }),
    ]);

    return apiList(rows, total, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Guru mengajukan pencairan upah (BR-05.4).
 *
 * Pengajuan selalu mencakup SELURUH upah `approved` milik guru yang belum
 * masuk payout mana pun — guru tidak memilih sendiri sesi mana yang
 * dicairkan. Menyederhanakannya begini membuat tidak ada upah yang
 * tertinggal diam-diam, dan membuat jumlah pengajuan terbuka tinggal satu.
 *
 * Idempotensinya dijaga unique sessionEarningId di PayoutItem: dua klik
 * bersamaan tidak bisa memasukkan upah yang sama ke dua pengajuan.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const user = await requireRole(RoleName.teacher);

    const open = await prisma.payout.findFirst({
      where: { teacherId: user.id, status: "requested" },
      select: { id: true },
    });
    if (open) {
      return apiError(
        "Masih ada pengajuan yang menunggu keputusan admin. Tunggu keputusannya sebelum mengajukan lagi.",
        409,
      );
    }

    const earnings = await prisma.sessionEarning.findMany({
      where: {
        teacherId: user.id,
        status: EarningStatus.approved,
        payoutItems: { none: {} },
      },
      select: { id: true, amount: true },
    });
    if (earnings.length === 0) {
      return apiError(
        "Belum ada upah yang siap dicairkan. Upah bisa diajukan setelah admin menyetujuinya.",
        422,
      );
    }

    const totalAmount = sumEarnings(earnings.map((e) => Number(e.amount)));

    const payout = await prisma.$transaction(async (tx) => {
      const created = await tx.payout.create({
        data: {
          teacherId: user.id,
          totalAmount,
          items: {
            create: earnings.map((earning) => ({
              sessionEarningId: earning.id,
            })),
          },
        },
        select: { id: true, totalAmount: true, status: true, requestedAt: true },
      });

      await writeAudit(tx, {
        actorId: user.id,
        entity: "Payout",
        entityId: created.id,
        action: "request",
        newData: { totalAmount, earningCount: earnings.length },
      });

      await createNotifications(tx, {
        userIds: await getAdminUserIds(tx),
        type: "payout_requested",
        title: "Pengajuan pencairan upah",
        body: `${user.name ?? "Seorang guru"} mengajukan pencairan ${formatRupiah(totalAmount)} untuk ${earnings.length} sesi.`,
        data: { payoutId: created.id },
      });

      return created;
    }, TX_OPTIONS);

    return apiOk(
      { ...payout, earningCount: earnings.length },
      { status: 201 },
    );
  } catch (error) {
    // Unique sessionEarningId: upah yang sama sudah masuk pengajuan lain.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      return apiError(
        "Sebagian upah sudah masuk pengajuan lain. Muat ulang halaman untuk melihat keadaan terbaru.",
        409,
      );
    }
    return handleApiError(error);
  }
}
