import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalWIB } from "@/lib/datetime";
import {
  PAYOUT_STATUS_LABEL,
  PAYOUT_STATUS_VARIANT,
} from "@/lib/payouts";
import {
  EarningStatus,
  PayoutStatus,
  RoleName,
} from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PayoutReviewPanel,
  type PendingEarning,
  type ReviewablePayout,
} from "./payout-review-panel";

export const metadata: Metadata = { title: "Upah & Payout" };

export default async function AdminPayoutsPage() {
  await requireRole(RoleName.super_admin, RoleName.admin);

  const [pending, open, history] = await Promise.all([
    prisma.sessionEarning.findMany({
      where: { status: EarningStatus.pending },
      select: {
        id: true,
        amount: true,
        teacher: { select: { fullName: true } },
        session: {
          select: {
            scheduledAt: true,
            durationMinutes: true,
            student: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.payout.findMany({
      where: {
        status: { in: [PayoutStatus.requested, PayoutStatus.approved] },
      },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        requestedAt: true,
        teacher: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { requestedAt: "asc" },
    }),
    prisma.payout.findMany({
      where: { status: { in: [PayoutStatus.paid, PayoutStatus.rejected] } },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        note: true,
        requestedAt: true,
        paidAt: true,
        teacher: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
  ]);

  const pendingEarnings: PendingEarning[] = pending.map((earning) => ({
    id: earning.id,
    teacherName: earning.teacher.fullName,
    studentName: earning.session.student?.fullName ?? "Murid",
    amount: Number(earning.amount),
    when: `${formatTanggalWIB(earning.session.scheduledAt)}, ${earning.session.durationMinutes} menit`,
  }));

  const payouts: ReviewablePayout[] = open.map((payout) => ({
    id: payout.id,
    teacherName: payout.teacher.fullName,
    amount: Number(payout.totalAmount),
    sessionCount: payout._count.items,
    requestedAt: formatTanggalWIB(payout.requestedAt),
    awaitingTransfer: payout.status === PayoutStatus.approved,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Upah &amp; payout
        </h1>
        <p className="text-sm text-plum-500">
          Setujui upah guru, lalu proses pengajuan pencairannya.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <PayoutReviewPanel
            pendingEarnings={pendingEarnings}
            payouts={payouts}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat pencairan</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-plum-500">
              Belum ada pencairan yang selesai.
            </p>
          ) : (
            <ul className="space-y-3">
              {history.map((payout) => (
                <li
                  key={payout.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-plum-800">
                      {payout.teacher.fullName} ·{" "}
                      {formatRupiah(Number(payout.totalAmount))}
                    </p>
                    <p className="text-xs text-plum-500">
                      {payout._count.items > 0
                        ? `${payout._count.items} sesi · `
                        : "upah dikembalikan · "}
                      diajukan {formatTanggalWIB(payout.requestedAt)}
                      {payout.paidAt
                        ? ` · ditransfer ${formatTanggalWIB(payout.paidAt)}`
                        : ""}
                    </p>
                    {payout.note ? (
                      <p className="text-sm text-plum-700">{payout.note}</p>
                    ) : null}
                  </div>
                  <Badge variant={PAYOUT_STATUS_VARIANT[payout.status]}>
                    {PAYOUT_STATUS_LABEL[payout.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
