import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalWIB } from "@/lib/datetime";
import {
  EARNING_STATUS_LABEL,
  EARNING_STATUS_VARIANT,
  PAYOUT_STATUS_LABEL,
  PAYOUT_STATUS_VARIANT,
  sumEarnings,
} from "@/lib/payouts";
import { EarningStatus, PayoutStatus, RoleName } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestPayoutButton } from "./request-payout-button";

export const metadata: Metadata = { title: "Upah Saya" };

/**
 * Ringkasan upah guru dan pencairannya (roadmap item 26, BR-05).
 *
 * Tiga angka di atas menjawab tiga pertanyaan berbeda: berapa yang masih
 * diperiksa admin, berapa yang sudah bisa diajukan, dan berapa yang sudah
 * benar-benar diterima. Menggabungkannya menjadi satu total akan menyamarkan
 * perbedaan yang justru paling ingin guru ketahui.
 */
export default async function TeacherEarningsPage() {
  const teacher = await requireRole(RoleName.teacher);

  const [earnings, payouts] = await Promise.all([
    prisma.sessionEarning.findMany({
      where: { teacherId: teacher.id },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        payoutItems: { select: { payoutId: true } },
        session: {
          select: {
            scheduledAt: true,
            durationMinutes: true,
            student: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.payout.findMany({
      where: { teacherId: teacher.id },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        note: true,
        requestedAt: true,
        paidAt: true,
        _count: { select: { items: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
  ]);

  const byStatus = (status: EarningStatus) =>
    earnings.filter((earning) => earning.status === status);

  const pendingTotal = sumEarnings(
    byStatus(EarningStatus.pending).map((e) => Number(e.amount)),
  );
  const paidTotal = sumEarnings(
    byStatus(EarningStatus.paid).map((e) => Number(e.amount)),
  );

  // Yang benar-benar bisa diajukan: sudah disetujui DAN belum masuk
  // pengajuan mana pun. Upah yang sedang menunggu keputusan admin tidak
  // boleh terhitung dua kali.
  const claimable = byStatus(EarningStatus.approved).filter(
    (earning) => earning.payoutItems.length === 0,
  );
  const claimableTotal = sumEarnings(claimable.map((e) => Number(e.amount)));

  const openPayout = payouts.find(
    (payout) => payout.status === PayoutStatus.requested,
  );

  const blockedReason = openPayout
    ? "Pengajuan Anda sedang menunggu keputusan admin. Pengajuan berikutnya bisa dibuat setelah yang ini diputuskan."
    : claimable.length === 0
      ? "Belum ada upah yang siap dicairkan. Upah bisa diajukan setelah admin menyetujuinya."
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Upah saya
        </h1>
        <p className="text-sm text-plum-500">
          Upah per sesi, persetujuan admin, dan riwayat pencairan.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Menunggu persetujuan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold text-plum-800">
              {formatRupiah(pendingTotal)}
            </p>
            <p className="text-xs text-plum-500">
              {byStatus(EarningStatus.pending).length} sesi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Siap dicairkan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold text-plum-800">
              {formatRupiah(claimableTotal)}
            </p>
            <p className="text-xs text-plum-500">{claimable.length} sesi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sudah dibayar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold text-plum-800">
              {formatRupiah(paidTotal)}
            </p>
            <p className="text-xs text-plum-500">
              {byStatus(EarningStatus.paid).length} sesi
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajukan pencairan</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestPayoutButton
            claimable={claimableTotal}
            sessionCount={claimable.length}
            blockedReason={blockedReason}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat pencairan</CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-sm text-plum-500">
              Belum pernah mengajukan pencairan.
            </p>
          ) : (
            <ul className="space-y-3">
              {payouts.map((payout) => (
                <li
                  key={payout.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-plum-800">
                      {formatRupiah(Number(payout.totalAmount))}
                      {/* Pengajuan yang ditolak melepas upahnya kembali,
                          sehingga jumlah sesinya nol — menuliskan "0 sesi"
                          akan terbaca seolah pengajuannya memang kosong. */}
                      {payout._count.items > 0
                        ? ` · ${payout._count.items} sesi`
                        : " · upah dikembalikan"}
                    </p>
                    <p className="text-xs text-plum-500">
                      Diajukan {formatTanggalWIB(payout.requestedAt)}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upah per sesi</CardTitle>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <p className="text-sm text-plum-500">
              Belum ada upah. Upah lahir saat Anda menandai sesi selesai.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {earnings.map((earning) => (
                <li
                  key={earning.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="text-sm text-plum-800">
                      {earning.session.student?.fullName ?? "Murid"} ·{" "}
                      {earning.session.durationMinutes} menit
                    </p>
                    <p className="text-xs text-plum-500">
                      {formatTanggalWIB(earning.session.scheduledAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-plum-800">
                      {formatRupiah(Number(earning.amount))}
                    </span>
                    <Badge variant={EARNING_STATUS_VARIANT[earning.status]}>
                      {EARNING_STATUS_LABEL[earning.status]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
