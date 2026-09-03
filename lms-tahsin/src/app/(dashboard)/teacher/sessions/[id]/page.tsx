import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { isAdmin, requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { CRITERION_SELECT, PRIVATE_CRITERION_SCOPES } from "@/lib/feedback";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalJamWIB } from "@/lib/datetime";
import { SESSION_STATUS_LABEL } from "@/lib/validations/session";
import { SessionStatus, SessionType } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionActionPanel } from "./session-action-panel";
import { FeedbackForm, type FeedbackInitial } from "./feedback-form";
import { MeetingLink } from "./meeting-link";

export const metadata: Metadata = { title: "Detail Sesi" };

/**
 * Detail satu sesi privat (PRD F-2c): status, aksi, dan feedback dalam
 * satu halaman, karena itulah tiga hal yang guru kerjakan berurutan
 * begitu selesai mengajar.
 */
export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      status: true,
      scheduledAt: true,
      durationMinutes: true,
      meetingUrl: true,
      notes: true,
      teacherId: true,
      substituteTeacherId: true,
      studentId: true,
      student: { select: { id: true, fullName: true } },
      charge: { select: { amount: true, status: true } },
      earning: { select: { amount: true, status: true, teacherId: true } },
      feedbacks: {
        select: {
          strengths: true,
          improvements: true,
          nextTarget: true,
          audioNoteUrl: true,
        },
      },
      grades: { select: { criterionId: true, score: true } },
    },
  });

  if (!session || session.type !== SessionType.private) notFound();

  const isOwnTeacher =
    user.id === session.teacherId || user.id === session.substituteTeacherId;
  // 404 dan bukan 403: guru lain tidak perlu tahu bahwa sesi ini ada.
  if (!isAdmin(user) && !isOwnTeacher) notFound();

  const criteria = await prisma.gradeCriterion.findMany({
    where: { scope: { in: PRIVATE_CRITERION_SCOPES } },
    select: CRITERION_SELECT,
    orderBy: { id: "asc" },
  });

  const feedback = session.feedbacks[0];
  const initialFeedback: FeedbackInitial = {
    scores: Object.fromEntries(
      session.grades.map((g) => [g.criterionId, Number(g.score)]),
    ),
    strengths: feedback?.strengths ?? "",
    improvements: feedback?.improvements ?? "",
    nextTarget: feedback?.nextTarget ?? "",
    audioNoteUrl: feedback?.audioNoteUrl ?? "",
  };

  // BR-10.3: guru melihat upahnya sendiri, tidak pernah upah guru lain.
  const ownEarning =
    session.earning && session.earning.teacherId === user.id
      ? session.earning
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="xs"
          nativeButton={false}
          render={<Link href="/teacher/sessions" />}
        >
          <ChevronLeft data-icon="inline-start" />
          Kembali ke sesi mingguan
        </Button>

        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            {session.student?.fullName ?? "Sesi privat"}
          </h1>
          <p className="text-sm text-plum-500">
            {formatTanggalJamWIB(session.scheduledAt)} ·{" "}
            {session.durationMinutes} menit
          </p>
          <Badge variant="secondary">
            {SESSION_STATUS_LABEL[session.status]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status sesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {session.meetingUrl ? (
              <MeetingLink
                url={session.meetingUrl}
                scheduledAtMs={session.scheduledAt.getTime()}
              />
            ) : (
              <p className="text-xs text-plum-500">
                Sesi ini belum punya tautan meeting.
              </p>
            )}

            <SessionActionPanel
              sessionId={session.id}
              status={session.status}
              notes={session.notes}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Keuangan sesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {session.charge ? (
              <>
                {isAdmin(user) ? (
                  <p className="text-plum-700">
                    Tagihan murid:{" "}
                    <strong>{formatRupiah(Number(session.charge.amount))}</strong>
                  </p>
                ) : null}
                {ownEarning ? (
                  <p className="text-plum-700">
                    Upah Anda:{" "}
                    <strong>{formatRupiah(Number(ownEarning.amount))}</strong>{" "}
                    <span className="text-plum-500">({ownEarning.status})</span>
                  </p>
                ) : (
                  <p className="text-plum-500">
                    Upah sesi ini tercatat atas nama guru pengganti.
                  </p>
                )}
              </>
            ) : (
              <p className="text-plum-500">
                Belum ada tagihan maupun upah. Keduanya dibuat saat sesi
                ditandai selesai — sesi yang diliburkan tidak pernah menagih.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feedback &amp; penilaian</CardTitle>
        </CardHeader>
        <CardContent>
          {session.status !== SessionStatus.completed ? (
            <p className="text-sm text-plum-500">
              Penilaian dibuka setelah sesi ditandai selesai dan murid hadir.
            </p>
          ) : criteria.length === 0 ? (
            <p className="text-sm text-plum-500">
              Rubrik penilaian belum disiapkan admin.
            </p>
          ) : (
            <FeedbackForm
              sessionId={session.id}
              criteria={criteria.map((c) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                maxScore: Number(c.maxScore),
              }))}
              initial={initialFeedback}
            />
          )}
        </CardContent>
      </Card>

      {session.student ? (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/teacher/students/${session.student.id}`} />}
        >
          Lihat progres {session.student.fullName}
        </Button>
      ) : null}
    </div>
  );
}
