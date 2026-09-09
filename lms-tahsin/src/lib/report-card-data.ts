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
  type StoredReportCard,
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

/**
 * Decimal Prisma dilihat secara struktural, bukan lewat tipe runtime-nya:
 * berkas ini hanya perlu tahu bahwa nilainya bisa dijadikan angka.
 */
type DecimalLike = { toNumber(): number };

/**
 * Baris ReportCard sebagaimana dibaca dari database, dengan KOLOM MINIMUM
 * yang dibutuhkan resolveReportCardView.
 *
 * Tipe ini adalah pagarnya: pemanggil yang lupa men-select salah satu kolom
 * snapshot akan gagal typecheck, bukan diam-diam menampilkan angka hidup di
 * bawah label `published` — persis bug yang pernah terjadi (Task 9) ketika
 * keputusan beku/segar masih ditulis tangan di tiap pemanggil.
 */
export type ReportCardSnapshotRow = {
  status: StoredReportCard["status"];
  finalGradeOverride: DecimalLike | null;
  attendancePct: DecimalLike | null;
  sessionsHeld: number;
  sessionsAttended: number;
  finalGradeComputed: DecimalLike | null;
  attendanceThresholdPct: DecimalLike;
  eligibleForNextLevel: boolean | null;
  scores: ReadonlyArray<{
    criterionId: number;
    averageScore: DecimalLike;
    sessionsScored: number;
  }>;
};

/**
 * Konversi baris Prisma menjadi data polos yang dimengerti report-card.ts.
 * Konversi Decimal → Number tinggal di sini, satu tempat, supaya modul murni
 * itu tetap nol impor Prisma (retro B1 §2).
 */
export function storedReportCardFrom(
  row: ReportCardSnapshotRow,
): StoredReportCard {
  return {
    status: row.status,
    finalGradeOverride:
      row.finalGradeOverride !== null ? Number(row.finalGradeOverride) : null,
    attendancePct: row.attendancePct !== null ? Number(row.attendancePct) : null,
    sessionsHeld: row.sessionsHeld,
    sessionsAttended: row.sessionsAttended,
    finalGradeComputed:
      row.finalGradeComputed !== null ? Number(row.finalGradeComputed) : null,
    attendanceThresholdPct: Number(row.attendanceThresholdPct),
    eligibleForNextLevel: row.eligibleForNextLevel,
    averages: row.scores.map((s) => ({
      criterionId: s.criterionId,
      averageScore: Number(s.averageScore),
      sessionsScored: s.sessionsScored,
    })),
  };
}

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

/**
 * Ketiga penghalang publikasi (spec B4 §4.4), lengkap dengan daftar isinya.
 *
 * `computations` opsional: pemanggil yang SUDAH punya hasil `computeReportCards`
 * untuk classGroupId yang sama (mis. GET /report-cards) meneruskannya di sini
 * supaya findUnique + kedua findMany di dalamnya tidak dijalankan dua kali
 * untuk data yang identik. Parameter ini WAJIB tetap opsional — Task 7
 * (endpoint terbitkan) memanggil fungsi ini sendirian tanpa computations siap.
 */
export async function publishBlockersFor(
  classGroupId: string,
  computations?: ReportCardComputation[],
): Promise<PublishBlockers> {
  const [makeups, stale, resolvedComputations] = await Promise.all([
    outstandingMakeupObligations(classGroupId),
    staleScheduledSessions(classGroupId),
    computations ? Promise.resolve(computations) : computeReportCards(classGroupId),
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
    studentsWithoutSessions: resolvedComputations
      .filter((c) => c.attendancePct === null)
      .map((c) => ({ studentId: c.studentId, fullName: c.studentName })),
  };
}
