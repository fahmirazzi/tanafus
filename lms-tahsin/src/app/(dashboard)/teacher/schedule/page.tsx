import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PrivateAssignmentStatus, RoleName } from "@/generated/prisma/enums";
import { addMinutesToTime } from "@/lib/schedules";
import { toDateInputWIB } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleManager, type ScheduleRow } from "./schedule-manager";

export const metadata: Metadata = { title: "Jadwal Berulang" };

export default async function TeacherSchedulePage() {
  const teacher = await requireRole(RoleName.teacher);

  const [rows, assignments, tiers] = await Promise.all([
    prisma.privateRecurringSchedule.findMany({
      where: { teacherId: teacher.id },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        durationMinutes: true,
        isActive: true,
        effectiveFrom: true,
        effectiveUntil: true,
        student: { select: { fullName: true } },
      },
      orderBy: [{ isActive: "desc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    // Hanya murid yang penugasannya masih hidup yang boleh dijadwalkan.
    prisma.privateAssignment.findMany({
      where: {
        teacherId: teacher.id,
        status: { not: PrivateAssignmentStatus.ended },
      },
      select: { student: { select: { id: true, fullName: true } } },
      orderBy: { student: { fullName: "asc" } },
    }),
    prisma.pricingTier.findMany({
      where: { isActive: true },
      select: { durationMinutes: true },
      orderBy: { durationMinutes: "asc" },
    }),
  ]);

  const schedules: ScheduleRow[] = rows.map((row) => ({
    id: row.id,
    studentName: row.student.fullName,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: addMinutesToTime(row.startTime, row.durationMinutes),
    durationMinutes: row.durationMinutes,
    isActive: row.isActive,
    effectiveFrom: row.effectiveFrom ? toDateInputWIB(row.effectiveFrom) : null,
    effectiveUntil: row.effectiveUntil
      ? toDateInputWIB(row.effectiveUntil)
      : null,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Jadwal berulang
        </h1>
        <p className="text-sm text-plum-500">
          Template mingguan per murid. Sesi konkret dibuat otomatis dari jadwal
          ini.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jadwal Anda</CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleManager
            schedules={schedules}
            students={assignments.map((a) => a.student)}
            durations={tiers.map((t) => t.durationMinutes)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
