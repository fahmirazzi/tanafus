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
import { formatJamWIB, formatTanggalWIB } from "@/lib/datetime";
import { SESSION_STATUS_LABEL } from "@/lib/validations/session";
import { DAY_OF_WEEK_LABEL } from "@/lib/validations/schedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OneTimeSessionForm } from "./one-time-session-form";

export const metadata: Metadata = { title: "Sesi Mingguan" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

  const gte = zonedDateTimeToUtc(days[0], "00:00");
  const lt = new Date(
    zonedDateTimeToUtc(days[days.length - 1], "00:00").getTime() + 86_400_000,
  );

  const [sessions, assignments, tiers] = await Promise.all([
    prisma.session.findMany({
      where: {
        type: SessionType.private,
        teacherId: teacher.id,
        scheduledAt: { gte, lt },
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        status: true,
        notes: true,
        student: { select: { fullName: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
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

  const byDay = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = zonedDateKey(session.scheduledAt);
    const list = byDay.get(key) ?? [];
    list.push(session);
    byDay.set(key, list);
  }

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const dow = new Date(`${day}T12:00:00.000Z`).getUTCDay();
          return (
            <Card key={day} className={day === todayKey ? "border-plum-700" : ""}>
              <CardHeader>
                <CardTitle className="text-sm">
                  {DAY_OF_WEEK_LABEL[dow]}
                  <span className="block text-xs font-normal text-plum-500">
                    {day}
                    {day === todayKey ? " · hari ini" : ""}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {list.length === 0 ? (
                  <p className="text-xs text-plum-500">Tidak ada sesi.</p>
                ) : (
                  list.map((session) => (
                    <div
                      key={session.id}
                      className="space-y-1 rounded-md border border-border p-2"
                    >
                      <p className="text-sm font-medium text-plum-800">
                        {formatJamWIB(session.scheduledAt)}–
                        {formatJamWIB(
                          new Date(
                            session.scheduledAt.getTime() +
                              session.durationMinutes * 60_000,
                          ),
                        )}
                      </p>
                      <p className="text-xs text-plum-700">
                        {session.student?.fullName ?? "—"}
                      </p>
                      <Badge variant="secondary">
                        {SESSION_STATUS_LABEL[session.status]}
                      </Badge>
                      {session.notes ? (
                        <p className="text-xs text-plum-500">{session.notes}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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
