import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { activeRoster } from "@/lib/class-groups";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalJamWIB, toDateInputWIB, toTimeInputWIB } from "@/lib/datetime";
import { CRITERION_SELECT, REGULAR_CRITERION_SCOPES } from "@/lib/feedback";
import { RoleName, SessionType } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionCard, type LessonOption, type SessionRow } from "./session-card";

export const metadata: Metadata = { title: "Detail Kelas Saya" };

/**
 * Detail kelas reguler milik guru: ringkasan, roster, dan sesi-sesinya —
 * tiap sesi punya penanda kehadiran, pemilih lesson, dan tombol
 * Mulai/Selesai/Batalkan (spec B1 §5.3, §5.4).
 */
export default async function TeacherClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const teacher = await requireRole(RoleName.teacher);
  const { id } = await params;

  const group = await prisma.classGroup.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      teacherId: true,
      honorPerSession: true,
      course: {
        select: {
          modules: {
            select: {
              title: true,
              lessons: { select: { id: true, title: true }, orderBy: { orderIndex: "asc" } },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
      period: { select: { name: true } },
    },
  });
  // 404, bukan 403: guru lain tidak perlu tahu kelas ini ada.
  if (!group || group.teacherId !== teacher.id) notFound();

  const [roster, sessions] = await Promise.all([
    activeRoster(id),
    prisma.session.findMany({
      where: { classGroupId: id, type: SessionType.regular },
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        status: true,
        lessonId: true,
        attendances: { select: { studentId: true, status: true, excuseReason: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 100,
    }),
  ]);

  // Penilaian kohort (Task 4, spec B4 §4.3): kriteria yang berlaku untuk
  // kelas reguler dan nilai yang sudah tersimpan, supaya form pra-terisi
  // alih-alih memaksa guru mengetik ulang dari nol setiap kali halaman dibuka.
  const criteria = await prisma.gradeCriterion.findMany({
    where: { scope: { in: REGULAR_CRITERION_SCOPES } },
    select: CRITERION_SELECT,
    orderBy: { id: "asc" },
  });
  const grades = await prisma.sessionGrade.findMany({
    where: { session: { classGroupId: id } },
    select: { sessionId: true, studentId: true, criterionId: true, score: true },
  });

  const lessons: LessonOption[] = group.course.modules.flatMap((mod) =>
    mod.lessons.map((lesson) => ({
      id: lesson.id,
      label: `${mod.title} · ${lesson.title}`,
    })),
  );

  const sessionRows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    scheduledAtLabel: formatTanggalJamWIB(s.scheduledAt),
    dateInput: toDateInputWIB(s.scheduledAt),
    timeInput: toTimeInputWIB(s.scheduledAt),
    durationMinutes: s.durationMinutes,
    status: s.status,
    lessonId: s.lessonId,
    marks: Object.fromEntries(
      s.attendances.map((a) => [
        a.studentId,
        { status: a.status, excuseReason: a.excuseReason ?? "" },
      ]),
    ),
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="xs"
          nativeButton={false}
          render={<Link href="/teacher/classes" />}
        >
          <ChevronLeft data-icon="inline-start" />
          Kembali ke kelas saya
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
              {group.name}
            </h1>
            <p className="text-sm text-plum-500">
              {group.period.name} · Honor {formatRupiah(Number(group.honorPerSession))}
              /sesi
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/teacher/classes/${id}/report-cards`} />}
          >
            Rapor kelas
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster ({roster.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <p className="text-sm text-plum-500">Belum ada murid aktif.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roster.map((r) => (
                <Badge key={r.studentId} variant="secondary">
                  {r.fullName}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-plum-800">Sesi</h2>
        {sessionRows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-plum-500">
              Belum ada sesi tergenerate untuk kelas ini.
            </CardContent>
          </Card>
        ) : (
          sessionRows.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              roster={roster}
              lessons={lessons}
              criteria={criteria.map((c) => ({
                id: c.id,
                name: c.name,
                maxScore: Number(c.maxScore),
              }))}
              grades={grades
                .filter((g) => g.sessionId === session.id)
                .map((g) => ({
                  studentId: g.studentId,
                  criterionId: g.criterionId,
                  score: Number(g.score),
                }))}
            />
          ))
        )}
      </div>
    </div>
  );
}
