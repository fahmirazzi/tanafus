import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, HandCoins, UserRound } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/currency";
import { formatJamWIB } from "@/lib/datetime";
import { sumEarnings } from "@/lib/payouts";
import { OCCUPYING_STATUSES, SESSION_STATUS_LABEL } from "@/lib/validations/session";
import { zonedDateKey, zonedDateTimeToUtc } from "@/lib/sessions";
import { EarningStatus, RoleName } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard Guru" };

/**
 * Dashboard guru (roadmap F-8, PRD "Dashboard Guru (Privat)").
 *
 * "Hari ini" ditaruh paling atas karena itu pertanyaan pertama guru saat
 * membuka aplikasi — bukan kalender mingguan penuh, yang sudah punya
 * halamannya sendiri di menu Jadwal.
 */
export default async function TeacherDashboardPage() {
  const teacher = await requireRole(RoleName.teacher);

  const now = new Date();
  const todayKey = zonedDateKey(now);
  const [year, month] = todayKey.slice(0, 7).split("-").map(Number);
  const monthStart = zonedDateTimeToUtc(`${todayKey.slice(0, 7)}-01`, "00:00");
  const nextMonthKey =
    month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const nextMonthStart = zonedDateTimeToUtc(`${nextMonthKey}-01`, "00:00");
  const todayStart = zonedDateTimeToUtc(todayKey, "00:00");
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const [todaySessions, sessionsThisMonth, earnings, suspendedCount] =
    await Promise.all([
      prisma.session.findMany({
        where: {
          teacherId: teacher.id,
          scheduledAt: { gte: todayStart, lt: todayEnd },
        },
        select: {
          id: true,
          scheduledAt: true,
          durationMinutes: true,
          status: true,
          student: { select: { fullName: true } },
        },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.session.count({
        where: {
          teacherId: teacher.id,
          status: { in: OCCUPYING_STATUSES },
          scheduledAt: { gte: monthStart, lt: nextMonthStart },
        },
      }),
      prisma.sessionEarning.findMany({
        where: { teacherId: teacher.id },
        select: { amount: true, status: true },
      }),
      prisma.privateAssignment.count({
        where: { teacherId: teacher.id, student: { NOT: { suspendedAt: null } } },
      }),
    ]);

  const pendingTotal = sumEarnings(
    earnings
      .filter((e) => e.status === EarningStatus.pending)
      .map((e) => Number(e.amount)),
  );
  const approvedTotal = sumEarnings(
    earnings
      .filter((e) => e.status === EarningStatus.approved)
      .map((e) => Number(e.amount)),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Assalamu&apos;alaikum, {teacher.name ?? "Ustadz/Ustadzah"}
        </h1>
        <p className="text-sm text-plum-500">Ringkasan hari ini dan bulan ini.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sesi hari ini ({todaySessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todaySessions.length === 0 ? (
            <p className="text-sm text-plum-500">Tidak ada sesi hari ini.</p>
          ) : (
            <ul className="divide-y divide-border">
              {todaySessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-plum-800">
                      {formatJamWIB(session.scheduledAt)} ·{" "}
                      {session.student?.fullName ?? "Murid"}
                    </p>
                    <p className="text-xs text-plum-500">
                      {session.durationMinutes} menit ·{" "}
                      {SESSION_STATUS_LABEL[session.status]}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/teacher/sessions/${session.id}`} />}
                  >
                    Buka
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sesi bulan ini</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold text-plum-800">
              {sessionsThisMonth}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upah</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-plum-700">
              Menunggu: {formatRupiah(pendingTotal)}
            </p>
            <p className="text-plum-700">
              Siap dicairkan: {formatRupiah(approvedTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Murid disuspend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold text-plum-800">
              {suspendedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/teacher/schedule" />}
        >
          <CalendarDays data-icon="inline-start" />
          Kalender mingguan
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/teacher/students" />}
        >
          <UserRound data-icon="inline-start" />
          Murid saya
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/teacher/earnings" />}
        >
          <HandCoins data-icon="inline-start" />
          Upah saya
        </Button>
      </div>
    </div>
  );
}
