import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  PrivateAssignmentStatus,
  RoleName,
  SessionType,
} from "@/generated/prisma/enums";
import {
  addDaysToKey,
  weekKeys,
  zonedDateKey,
  zonedDateTimeToUtc,
} from "@/lib/sessions";
import { formatTanggalWIB, toTimeInputWIB } from "@/lib/datetime";
import { DEFAULT_PAGE_SIZE } from "@/lib/api";
import { totalPages as calcTotalPages } from "@/lib/pagination-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationNav } from "@/components/pagination-nav";
import { OneTimeSessionForm } from "./one-time-session-form";
import { WeekBoard, type BoardSession } from "./week-board";

export const metadata: Metadata = { title: "Sesi Mingguan" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Nilai bukan angka, nol, atau negatif jatuh ke halaman 1. */
function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function TeacherSessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const teacher = await requireRole(RoleName.teacher);
  const params = await searchParams;

  const todayKey = zonedDateKey(new Date());
  const anchor = one(params.week);
  // Query string yang dikutak-katik jangan sampai membuat halaman gagal.
  const cursor = anchor && ISO_DATE.test(anchor) ? anchor : todayKey;
  const days = weekKeys(cursor);
  const page = parsePage(one(params.page));

  const gte = zonedDateTimeToUtc(days[0], "00:00");
  const lt = new Date(
    zonedDateTimeToUtc(days[days.length - 1], "00:00").getTime() + 86_400_000,
  );

  const sessionsWhere = {
    type: SessionType.private,
    teacherId: teacher.id,
    scheduledAt: { gte, lt },
  };

  const [sessions, sessionsTotal, assignments, tiers] = await Promise.all([
    prisma.session.findMany({
      where: sessionsWhere,
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        status: true,
        notes: true,
        student: { select: { fullName: true } },
      },
      orderBy: { scheduledAt: "asc" },
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
    }),
    prisma.session.count({ where: sessionsWhere }),
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

  const sessionsPages = calcTotalPages(sessionsTotal, DEFAULT_PAGE_SIZE);

  // Date dan Decimal tidak bisa menyeberang ke client component apa adanya,
  // jadi jam sudah diformat WIB di server.
  const board: BoardSession[] = sessions.map((session) => ({
    id: session.id,
    dateKey: zonedDateKey(session.scheduledAt),
    startTime: toTimeInputWIB(session.scheduledAt),
    endTime: toTimeInputWIB(
      new Date(
        session.scheduledAt.getTime() + session.durationMinutes * 60_000,
      ),
    ),
    durationMinutes: session.durationMinutes,
    studentName: session.student?.fullName ?? "—",
    status: session.status,
    notes: session.notes,
  }));

  const prevWeek = addDaysToKey(days[0], -7);
  const nextWeek = addDaysToKey(days[0], 7);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            Sesi mingguan
          </h1>
          <p className="text-sm text-plum-500">
            {formatTanggalWIB(zonedDateTimeToUtc(days[0], "12:00"))} –{" "}
            {formatTanggalWIB(zonedDateTimeToUtc(days[6], "12:00"))}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/teacher/sessions?week=${prevWeek}`} />}
          >
            <ChevronLeft data-icon="inline-start" />
            Pekan lalu
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/teacher/sessions" />}
          >
            Pekan ini
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/teacher/sessions?week=${nextWeek}`} />}
          >
            Pekan depan
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </div>

      <WeekBoard days={days} sessions={board} todayKey={todayKey} />

      <PaginationNav
        pathname="/teacher/sessions"
        params={{ week: anchor }}
        page={page}
        totalPages={sessionsPages}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sesi tambahan (one-time)</CardTitle>
        </CardHeader>
        <CardContent>
          <OneTimeSessionForm
            students={assignments.map((a) => a.student)}
            durations={tiers.map((t) => t.durationMinutes)}
            defaultDate={todayKey}
          />
        </CardContent>
      </Card>
    </div>
  );
}
