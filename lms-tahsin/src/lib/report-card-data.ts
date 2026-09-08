import { prisma } from "@/lib/prisma";
import {
  attendanceRecap,
  averageByCriterion,
  finalGradeFrom,
  isEligible,
  tallyAttendance,
  type AttendanceTally,
  type CriterionAverage,
  type PublishBlockers,
} from "@/lib/report-card";
import {
  outstandingMakeupObligations,
  staleScheduledSessions,
} from "@/lib/class-groups";
import { SessionStatus } from "@/generated/prisma/enums";

/**
 * Menyusun bahan mentah rapor dari database lalu menyerahkannya ke modul
 * murni report-card.ts. Berkas ini menyentuh Prisma, jadi TIDAK punya .test.ts
 * (retro B1 §2) — seluruh aturannya diuji di sana.
 */

export type ReportCardComputation = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  /**
   * Rincian hadir/terlambat/izin/bolos sebelum diringkas jadi attendancePct.
   * Task 9 (ekspor CSV kehadiran) butuh rincian ini per murid — tanpa field
   * ini ia akan mengkueri ulang SessionAttendance dengan filter status sesi
   * yang PERSIS sama, menduplikasi definisi BR-02.6a di dua tempat.
   */
  tally: AttendanceTally;
  sessionsHeld: number;
  sessionsAttended: number;
  attendancePct: number | null;
  averages: CriterionAverage[];
  finalGradeComputed: number | null;
  attendanceThresholdPct: number;
  eligibleForNextLevel: boolean | null;
};

/** Status sesi yang BENAR-BENAR berlangsung (BR-02.6a). */
const HELD: SessionStatus[] = [
  SessionStatus.completed,
  SessionStatus.completed_absent,
];

export async function computeReportCards(
  classGroupId: string,
): Promise<ReportCardComputation[]> {
  const group = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: {
      course: { select: { attendanceThresholdPct: true } },
      enrollments: {
        where: { status: { in: ["active", "suspended"] } },
        select: {
          id: true,
          studentId: true,
          student: { select: { fullName: true } },
        },
        orderBy: { student: { fullName: "asc" } },
      },
    },
  });
  if (!group) return [];

  const thresholdPct = Number(group.course.attendanceThresholdPct);

  // Satu kueri untuk seluruh kelas, bukan satu per murid: lima belas murid
  // kali dua kueri adalah tiga puluh round-trip untuk data yang sama.
  const [marks, scores] = await Promise.all([
    prisma.sessionAttendance.findMany({
      where: { session: { classGroupId, status: { in: HELD } } },
      select: { studentId: true, status: true },
    }),
    prisma.sessionGrade.findMany({
      where: { session: { classGroupId, status: { in: HELD } } },
      select: { studentId: true, criterionId: true, score: true },
    }),
  ]);

  return group.enrollments.map((enrollment) => {
    // Penyebut hanya menghitung sesi yang PUNYA baris kehadiran atas nama
    // murid ini. Itulah yang membuat murid pendaftar tengah periode tidak
    // dihukum atas sesi sebelum ia bergabung — tanpa perhitungan tanggal
    // tersendiri yang bisa menyimpang dari mekanisme yang sudah ada.
    const tally = tallyAttendance(
      marks.filter((m) => m.studentId === enrollment.studentId),
    );
    const recap = attendanceRecap(tally);
    const averages = averageByCriterion(
      scores
        .filter((s) => s.studentId === enrollment.studentId)
        .map((s) => ({ criterionId: s.criterionId, score: Number(s.score) })),
    );
    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      studentName: enrollment.student.fullName,
      tally,
      sessionsHeld: recap.sessionsHeld,
      sessionsAttended: recap.sessionsAttended,
      attendancePct: recap.attendancePct,
      averages,
      finalGradeComputed: finalGradeFrom(averages),
      attendanceThresholdPct: thresholdPct,
      eligibleForNextLevel: isEligible(recap.attendancePct, thresholdPct),
    };
  });
}

/** Ketiga penghalang publikasi (spec B4 §4.4), lengkap dengan daftar isinya. */
export async function publishBlockersFor(
  classGroupId: string,
): Promise<PublishBlockers> {
  const [makeups, stale, computations] = await Promise.all([
    outstandingMakeupObligations(classGroupId),
    staleScheduledSessions(classGroupId),
    computeReportCards(classGroupId),
  ]);

  return {
    outstandingMakeups: makeups.map((s) => ({
      sessionId: s.id,
      scheduledAt: s.scheduledAt,
    })),
    staleSessions: stale.map((s) => ({
      sessionId: s.id,
      scheduledAt: s.scheduledAt,
    })),
    studentsWithoutSessions: computations
      .filter((c) => c.attendancePct === null)
      .map((c) => ({ studentId: c.studentId, fullName: c.studentName })),
  };
}
