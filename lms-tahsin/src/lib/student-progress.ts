import { prisma } from "@/lib/prisma";
import { CRITERION_SELECT, PRIVATE_CRITERION_SCOPES } from "@/lib/feedback";
import { buildProgressSeries, type ProgressSeries } from "@/lib/progress";
import { SessionType } from "@/generated/prisma/enums";

/**
 * Data halaman progres murid (PRD F-4d, roadmap item 19).
 *
 * Dipakai halaman orang tua maupun halaman guru: keduanya melihat angka
 * yang sama, yang berbeda hanya siapa yang boleh membukanya — itu urusan
 * assertCanAccess di masing-masing halaman, bukan urusan query ini.
 */

/** Jumlah feedback terbaru yang ditampilkan; sisanya bukan untuk satu layar. */
const FEEDBACK_LIMIT = 20;

/** Batas atas nilai yang dibaca; cukup untuk lebih dari setahun sesi mingguan. */
const GRADE_LIMIT = 400;

export type FeedbackEntry = {
  sessionId: string;
  scheduledAt: Date;
  teacherName: string;
  strengths: string | null;
  improvements: string | null;
  nextTarget: string | null;
  audioNoteUrl: string | null;
  scores: { criterionName: string; score: number; maxScore: number }[];
};

export type StudentProgress = {
  /** Skala tiap kriteria, dipakai grafik sebagai batas atas sumbu y. */
  maxScoreByCriterion: Map<number, number>;
  series: ProgressSeries[];
  feedbacks: FeedbackEntry[];
  sessionsGraded: number;
};

export async function loadStudentProgress(
  studentId: string,
): Promise<StudentProgress> {
  const [criteria, grades, feedbacks] = await Promise.all([
    prisma.gradeCriterion.findMany({
      where: { scope: { in: PRIVATE_CRITERION_SCOPES } },
      select: CRITERION_SELECT,
      orderBy: { id: "asc" },
    }),
    prisma.sessionGrade.findMany({
      where: { studentId, session: { type: SessionType.private } },
      select: {
        sessionId: true,
        criterionId: true,
        score: true,
        criterion: { select: { name: true } },
        session: { select: { scheduledAt: true } },
      },
      orderBy: { session: { scheduledAt: "asc" } },
      take: GRADE_LIMIT,
    }),
    prisma.sessionFeedback.findMany({
      where: { studentId },
      select: {
        sessionId: true,
        strengths: true,
        improvements: true,
        nextTarget: true,
        audioNoteUrl: true,
        session: {
          select: {
            scheduledAt: true,
            teacher: { select: { fullName: true } },
            substitute: { select: { fullName: true } },
          },
        },
      },
      orderBy: { session: { scheduledAt: "desc" } },
      take: FEEDBACK_LIMIT,
    }),
  ]);

  const maxScoreByCriterion = new Map(
    criteria.map((c) => [c.id, Number(c.maxScore)]),
  );

  const series = buildProgressSeries(
    grades.map((g) => ({
      sessionId: g.sessionId,
      scheduledAt: g.session.scheduledAt,
      criterionId: g.criterionId,
      criterionName: g.criterion.name,
      score: Number(g.score),
    })),
  );

  // Nilai per sesi dikelompokkan sekali di sini supaya kartu feedback bisa
  // menampilkan rapor sesi itu tanpa query tambahan per baris.
  const scoresBySession = new Map<
    string,
    { criterionName: string; score: number; maxScore: number }[]
  >();
  for (const grade of grades) {
    const row = {
      criterionName: grade.criterion.name,
      score: Number(grade.score),
      maxScore: maxScoreByCriterion.get(grade.criterionId) ?? 100,
    };
    const bucket = scoresBySession.get(grade.sessionId);
    if (bucket) bucket.push(row);
    else scoresBySession.set(grade.sessionId, [row]);
  }

  return {
    maxScoreByCriterion,
    series,
    sessionsGraded: scoresBySession.size,
    feedbacks: feedbacks.map((f) => ({
      sessionId: f.sessionId,
      scheduledAt: f.session.scheduledAt,
      teacherName:
        f.session.substitute?.fullName ?? f.session.teacher?.fullName ?? "—",
      strengths: f.strengths,
      improvements: f.improvements,
      nextTarget: f.nextTarget,
      audioNoteUrl: f.audioNoteUrl,
      scores: scoresBySession.get(f.sessionId) ?? [],
    })),
  };
}
