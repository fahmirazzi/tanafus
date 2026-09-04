import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarOff,
  Inbox,
  Receipt,
  UserMinus,
  Wallet,
} from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalWIB } from "@/lib/datetime";
import { INVOICE_STATUS_LABEL } from "@/lib/invoices";
import { zonedDateKey, zonedDateTimeToUtc } from "@/lib/sessions";
import { OCCUPYING_STATUSES } from "@/lib/validations/session";
import {
  EarningStatus,
  InvoiceStatus,
  PayoutStatus,
  RoleName,
  SessionType,
  SimpleApprovalStatus,
  TeacherRequestStatus,
} from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard Admin" };

/**
 * Dashboard admin (roadmap item 27, PRD bagian dashboard admin).
 *
 * Isinya dibatasi pada hal yang MENAHAN pekerjaan orang lain: antrean yang
 * menunggu keputusan admin, tunggakan yang menunggu ditagih, dan murid yang
 * terhenti karenanya. Angka sekadar-menarik — total omzet, tren bulanan —
 * sengaja tidak ditaruh di sini; tempatnya nanti di laporan. "Sesi hari
 * ini" satu-satunya pengecualian: PRD memintanya eksplisit, dan cukup satu
 * angka di subjudul, bukan kartu sendiri, supaya antrean tetap yang utama.
 */
export default async function AdminDashboardPage() {
  const user = await requireRole(RoleName.super_admin, RoleName.admin);

  const todayKey = zonedDateKey(new Date());
  const todayStart = zonedDateTimeToUtc(todayKey, "00:00");
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const [
    sessionsToday,
    teacherRequests,
    studentBreaks,
    payoutRequests,
    pendingEarnings,
    pendingProofs,
    overdueInvoices,
    suspendedStudents,
  ] = await Promise.all([
    prisma.session.count({
      where: {
        type: SessionType.private,
        status: { in: OCCUPYING_STATUSES },
        scheduledAt: { gte: todayStart, lt: todayEnd },
      },
    }),
    prisma.teacherRequest.count({
      where: { status: TeacherRequestStatus.pending },
    }),
    prisma.studentBreak.count({ where: { status: SimpleApprovalStatus.pending } }),
    prisma.payout.count({ where: { status: PayoutStatus.requested } }),
    prisma.sessionEarning.count({ where: { status: EarningStatus.pending } }),
    prisma.payment.count({
      where: { status: "pending", proofUrl: { not: null } },
    }),
    prisma.invoice.findMany({
      where: { status: InvoiceStatus.overdue },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        dueDate: true,
        status: true,
        student: { select: { fullName: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.user.findMany({
      where: { NOT: { suspendedAt: null } },
      select: { id: true, fullName: true, suspensionReason: true },
      orderBy: { fullName: "asc" },
      take: 10,
    }),
  ]);

  const overdueTotal = overdueInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total),
    0,
  );

  const queues = [
    {
      label: "Permintaan guru",
      count: teacherRequests,
      href: "/admin/requests",
      icon: Inbox,
    },
    {
      label: "Pengajuan libur murid",
      count: studentBreaks,
      href: "/admin/requests",
      icon: CalendarOff,
    },
    {
      label: "Bukti transfer",
      count: pendingProofs,
      href: "/admin/invoices",
      icon: Receipt,
    },
    {
      label: "Upah menunggu persetujuan",
      count: pendingEarnings,
      href: "/admin/payouts",
      icon: Wallet,
    },
    {
      label: "Pengajuan pencairan",
      count: payoutRequests,
      href: "/admin/payouts",
      icon: Wallet,
    },
  ];

  const totalQueue = queues.reduce((sum, queue) => sum + queue.count, 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Dashboard admin
        </h1>
        <p className="text-sm text-plum-500">
          Selamat datang, {user.name ?? "Admin"}. Hari ini{" "}
          {formatTanggalWIB(new Date())} (WIB) · {sessionsToday} sesi privat
          berjalan hari ini.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {totalQueue === 0
              ? "Tidak ada antrean"
              : `Menunggu keputusan Anda (${totalQueue})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalQueue === 0 ? (
            <p className="text-sm text-plum-500">
              Semua permintaan sudah diputuskan. Tidak ada yang menunggu.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {queues
                .filter((queue) => queue.count > 0)
                .map((queue) => (
                  <li key={queue.label}>
                    <Link
                      href={queue.href}
                      className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-cream-100"
                    >
                      <queue.icon className="size-5 shrink-0 text-plum-500" />
                      <span className="flex-1 text-sm text-plum-700">
                        {queue.label}
                      </span>
                      <span className="font-heading text-lg font-semibold text-plum-800">
                        {queue.count}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tagihan terlambat
            {overdueInvoices.length > 0
              ? ` — ${formatRupiah(overdueTotal)}`
              : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {overdueInvoices.length === 0 ? (
            <p className="text-sm text-plum-500">
              Tidak ada tagihan yang lewat jatuh tempo.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {overdueInvoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-plum-800">
                          {invoice.invoiceNumber}
                        </span>
                        <Badge variant="destructive">
                          {INVOICE_STATUS_LABEL[invoice.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-plum-500">
                        {invoice.student.fullName} · jatuh tempo{" "}
                        {formatTanggalWIB(invoice.dueDate)}
                      </p>
                    </div>
                    <span className="text-plum-800">
                      {formatRupiah(Number(invoice.total))}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/admin/invoices?status=overdue" />}
              >
                Kelola tagihan
                <ArrowRight data-icon="inline-end" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Murid disuspend ({suspendedStudents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {suspendedStudents.length === 0 ? (
            <p className="text-sm text-plum-500">
              Tidak ada murid yang sedang dihentikan sementara.
            </p>
          ) : (
            <ul className="space-y-2">
              {suspendedStudents.map((student) => (
                <li
                  key={student.id}
                  className="flex items-start gap-3 rounded-md border border-border p-3"
                >
                  <UserMinus className="size-4 shrink-0 text-destructive" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-plum-800">
                      {student.fullName}
                    </p>
                    {student.suspensionReason ? (
                      <p className="text-xs text-plum-500">
                        {student.suspensionReason}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {suspendedStudents.length > 0 ? (
            <p className="flex items-start gap-2 pt-3 text-xs text-plum-500">
              <AlertTriangle className="size-3.5 shrink-0" />
              Sesi yang sudah terjadwal tetap berjalan. Cabut suspensi dari
              halaman tagihan murid setelah tunggakannya diselesaikan.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
