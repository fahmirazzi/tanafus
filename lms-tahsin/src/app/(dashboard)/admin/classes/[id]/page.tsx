import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { enrollmentChargesForClassGroup, outstandingMakeupObligations, staleScheduledSessions } from "@/lib/class-groups";
import { ChargeManager, type ChargeRow } from "./charge-manager";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalJamWIB, formatTanggalWIB } from "@/lib/datetime";
import { RoleName } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClassGroupForm } from "../class-group-form";
import { ScheduleManager, type ScheduleRow } from "./schedule-manager";
import { RosterManager, type RosterRow } from "./roster-manager";

export const metadata: Metadata = { title: "Detail Kelas" };

const AUDIENCE_LABEL: Record<string, string> = {
  children: "Anak-anak",
  adult: "Dewasa",
};

/**
 * Detail kelas reguler: ringkasan, jadwal mingguan, roster, dan kewajiban
 * make-up yang belum diselesaikan (spec B1 §5.4) — SATU-SATUNYA konsekuensi
 * make-up tertunda di B1, gerbang kerasnya baru datang di B4.
 */
export default async function AdminClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(RoleName.super_admin, RoleName.admin);
  const { id } = await params;

  const group = await prisma.classGroup.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      audience: true,
      status: true,
      capacity: true,
      price: true,
      honorPerSession: true,
      course: { select: { id: true, name: true } },
      period: { select: { id: true, name: true, startDate: true, endDate: true } },
      teacher: { select: { id: true, fullName: true } },
      schedules: {
        where: { isActive: true },
        select: {
          id: true,
          dayOfWeek: true,
          startTime: true,
          durationMinutes: true,
          meetingUrl: true,
          isActive: true,
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
      enrollments: {
        select: {
          id: true,
          studentId: true,
          status: true,
          enrolledAt: true,
          droppedAt: true,
          student: { select: { fullName: true } },
        },
        orderBy: { enrolledAt: "asc" },
      },
    },
  });
  if (!group) notFound();

  const [obligations, staleSessions, charges, students, courses, periods, teachers] = await Promise.all([
    outstandingMakeupObligations(id),
    staleScheduledSessions(id),
    enrollmentChargesForClassGroup(id),
    prisma.user.findMany({
      where: { roles: { some: { role: { name: RoleName.student } } } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.course.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.academicPeriod.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: { name: RoleName.teacher } } } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const schedules: ScheduleRow[] = group.schedules.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    durationMinutes: s.durationMinutes,
    meetingUrl: s.meetingUrl,
    isActive: s.isActive,
  }));

  const roster: RosterRow[] = group.enrollments.map((e) => ({
    studentId: e.studentId,
    fullName: e.student.fullName,
    status: e.status,
    enrolledAtLabel: formatTanggalWIB(e.enrolledAt),
    droppedAtLabel: e.droppedAt ? formatTanggalWIB(e.droppedAt) : null,
  }));

  const chargeRows: ChargeRow[] = charges.map((c) => ({
    id: c.id,
    enrollmentId: c.enrollmentId,
    studentName: c.studentName,
    installmentNo: c.installmentNo,
    amount: c.amount,
    dueDate: formatTanggalWIB(c.dueDate),
    status: c.status,
    invoiced: c.invoiced,
  }));

  const activeRosterIds = new Set(
    roster.filter((r) => r.status === "active").map((r) => r.studentId),
  );
  const availableStudents = students.filter((s) => !activeRosterIds.has(s.id));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="xs"
          nativeButton={false}
          render={<Link href="/admin/classes" />}
        >
          <ChevronLeft data-icon="inline-start" />
          Kembali ke daftar kelas
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
              {group.name}
            </h1>
            <p className="text-sm text-plum-500">
              {group.course.name} · {group.period.name} · Guru{" "}
              {group.teacher.fullName}
            </p>
          </div>
          <Badge variant={group.status === "open" ? "default" : "secondary"}>
            {group.status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 pt-6">
            <p className="text-xs text-plum-500">Audiens</p>
            <p className="text-sm font-medium text-plum-800">
              {AUDIENCE_LABEL[group.audience] ?? group.audience}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-6">
            <p className="text-xs text-plum-500">Kapasitas</p>
            <p className="text-sm font-medium text-plum-800">
              {roster.filter((r) => r.status === "active").length} /{" "}
              {group.capacity}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-6">
            <p className="text-xs text-plum-500">Biaya periode</p>
            <p className="text-sm font-medium text-plum-800">
              {formatRupiah(Number(group.price))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-6">
            <p className="text-xs text-plum-500">Honor guru / sesi</p>
            <p className="text-sm font-medium text-plum-800">
              {formatRupiah(Number(group.honorPerSession))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit kelas</CardTitle>
        </CardHeader>
        <CardContent>
          <ClassGroupForm
            mode="edit"
            classGroupId={id}
            courses={courses}
            periods={periods}
            teachers={teachers}
            initial={{
              name: group.name,
              courseId: group.course.id,
              periodId: group.period.id,
              teacherId: group.teacher.id,
              audience: group.audience,
              capacity: group.capacity,
              price: Number(group.price),
              honorPerSession: Number(group.honorPerSession),
              status: group.status,
            }}
          />
        </CardContent>
      </Card>

      {obligations.length > 0 ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Kewajiban make-up belum diselesaikan ({obligations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-plum-700">
              Kelas ini pernah dibatalkan lembaga tanpa sesi pengganti yang
              tercatat. Ini satu-satunya konsekuensi make-up yang tertunda di
              rilis ini — jadwalkan sesi penggantinya.
            </p>
            <ul className="space-y-1">
              {obligations.map((o) => (
                <li key={o.id} className="text-sm text-plum-700">
                  Sesi {formatTanggalJamWIB(o.scheduledAt)} dibatalkan, belum
                  ada penggantinya.
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {staleSessions.length > 0 ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Sesi belum ditutup ({staleSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-plum-700">
              Jam sesi berikut sudah lewat tapi statusnya masih
              &quot;terjadwal&quot; — gurunya kemungkinan lupa menekan
              &quot;Selesai&quot;. Tidak ada penutupan otomatis; tindak
              lanjuti manual lewat kehadiran/status sesi guru yang
              bersangkutan.
            </p>
            <ul className="space-y-1">
              {staleSessions.map((s) => (
                <li key={s.id} className="text-sm text-plum-700">
                  Sesi {formatTanggalJamWIB(s.scheduledAt)} ({s.durationMinutes}{" "}
                  menit) masih &quot;terjadwal&quot;.
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jadwal mingguan</CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleManager classGroupId={id} schedules={schedules} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Roster ({roster.filter((r) => r.status === "active").length}{" "}
            aktif)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RosterManager
            classGroupId={id}
            roster={roster}
            availableStudents={availableStudents}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tagihan periode</CardTitle>
        </CardHeader>
        <CardContent>
          <ChargeManager classGroupId={id} charges={chargeRows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Periode</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-plum-700">
          {formatTanggalWIB(group.period.startDate)} —{" "}
          {formatTanggalWIB(group.period.endDate)}
        </CardContent>
      </Card>
    </div>
  );
}
