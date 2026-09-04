import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Receipt, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalJamWIB } from "@/lib/datetime";
import { isPayable } from "@/lib/invoices";
import { viewableStudentIds } from "@/lib/students";
import { RoleName, SessionStatus, SessionType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard Orang Tua" };

/** Sesi 7 hari ke depan yang ditampilkan di beranda. */
const UPCOMING_DAYS = 7;

/**
 * Dashboard orang tua (roadmap F-8, PRD "Dashboard Parent").
 *
 * "Jadwal anak" ditaruh di beranda karena itu yang paling sering dicek
 * orang tua — bukan progres atau tagihan, yang keduanya sudah punya
 * halaman sendiri dan tidak berubah tiap hari.
 */
export default async function ParentDashboardPage() {
  const user = await requireRole(RoleName.parent, RoleName.student);
  const studentIds = await viewableStudentIds(user);

  if (studentIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Dashboard
        </h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-plum-500">
            Belum ada anak yang terhubung dengan akun Anda. Hubungi admin
            untuk menautkan akun.
          </CardContent>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const upcomingUntil = new Date(now.getTime() + UPCOMING_DAYS * 86_400_000);

  const [upcomingSessions, outstandingInvoices] = await Promise.all([
    prisma.session.findMany({
      where: {
        type: SessionType.private,
        studentId: { in: studentIds },
        // Bukan OCCUPYING_STATUSES: itu untuk cek bentrok jadwal, bukan
        // "apa yang akan datang" — sesi yang sudah completed/excused tidak
        // pantas tampil sebagai jadwal mendatang meski waktunya kebetulan
        // belum lewat (mis. guru menutup sesi lebih awal dari jadwal).
        status: { in: [SessionStatus.scheduled, SessionStatus.in_progress] },
        scheduledAt: { gte: now, lt: upcomingUntil },
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        student: { select: { fullName: true } },
        teacher: { select: { fullName: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
    prisma.invoice.findMany({
      where: { studentId: { in: studentIds } },
      select: { id: true, invoiceNumber: true, total: true, status: true },
    }),
  ]);

  const outstanding = outstandingInvoices.filter((inv) => isPayable(inv.status));
  const outstandingTotal = outstanding.reduce(
    (sum, inv) => sum + Number(inv.total),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Assalamu&apos;alaikum, {user.name ?? "Wali"}
        </h1>
        <p className="text-sm text-plum-500">
          Jadwal {UPCOMING_DAYS} hari ke depan dan hal yang perlu perhatian.
        </p>
      </div>

      {outstanding.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Tagihan belum dibayar — {formatRupiah(outstandingTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/parent/billing" />}
            >
              <Receipt data-icon="inline-start" />
              Lihat &amp; bayar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Jadwal {UPCOMING_DAYS} hari ke depan ({upcomingSessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingSessions.length === 0 ? (
            <p className="text-sm text-plum-500">
              Tidak ada sesi terjadwal dalam {UPCOMING_DAYS} hari ke depan.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {upcomingSessions.map((session) => (
                <li key={session.id} className="py-3 text-sm">
                  <p className="font-medium text-plum-800">
                    {session.student?.fullName ?? "Murid"} ·{" "}
                    {formatTanggalJamWIB(session.scheduledAt)}
                  </p>
                  <p className="text-xs text-plum-500">
                    {session.durationMinutes} menit bersama{" "}
                    {session.teacher?.fullName ?? "guru"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/parent/progress" />}
        >
          <TrendingUp data-icon="inline-start" />
          Progres anak
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/parent/breaks" />}
        >
          <CalendarDays data-icon="inline-start" />
          Ajukan libur
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/parent/billing" />}
        >
          <ArrowRight data-icon="inline-start" />
          Semua tagihan
        </Button>
      </div>
    </div>
  );
}
