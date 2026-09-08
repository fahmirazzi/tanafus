/**
 * Matematika rapor kelas reguler (spec B4 §4.2).
 *
 * Murni: menerima baris-baris polos, tidak menyentuh @/lib/prisma. Kueri yang
 * menyusun bahannya ada di report-card-data.ts. Pemisahan ini bukan selera —
 * retro B1 §2: modul yang punya .test.ts tidak boleh memuat PrismaClient,
 * karena test runner tidak punya database.
 */

export type AttendanceMarkStatus = "present" | "late" | "excused" | "absent";

export type AttendanceTally = {
  present: number;
  late: number;
  excused: number;
  absent: number;
};

export type AttendanceRecap = {
  /** Penyebut BR-02.6a. */
  sessionsHeld: number;
  /** Pembilang: present + late. */
  sessionsAttended: number;
  /** Null bila penyebut nol — lihat catatan di attendanceRecap. */
  attendancePct: number | null;
};

/**
 * Pembulatan setengah-ke-atas ke dua desimal.
 *
 * Epsilon ABSOLUT (1e-9) pada skala ratusan, bukan `value + Number.EPSILON`:
 * EPSILON berskala 2.2e-16 dan hanya cukup mengoreksi galat representasi
 * selagi ia masih signifikan relatif terhadap nilainya. Untuk besaran dua
 * digit ia tidak lagi cukup — 5.015 tersimpan sebagai 5.014999… sehingga
 * versi lamanya menghasilkan 5.01, padahal 2.005 dan 83.335 kebetulan benar.
 * Nilai .xx5 seperti itu betul-betul tercapai lewat finalGradeFrom yang
 * merata-ratakan angka yang SUDAH dibulatkan.
 *
 * 1e-9 jauh lebih besar daripada galat representasi pada rentang nilai rapor
 * (0-100) namun jauh lebih kecil daripada satu perseratus, jadi ia tidak
 * pernah menggeser angka yang memang tidak berada di batas pembulatan.
 */
export function roundTo2(value: number): number {
  return Math.round(value * 100 + 1e-9) / 100;
}

const COUNTED: readonly string[] = ["present", "late", "excused", "absent"];

export function tallyAttendance(
  marks: readonly { status: string }[],
): AttendanceTally {
  const tally: AttendanceTally = { present: 0, late: 0, excused: 0, absent: 0 };
  for (const mark of marks) {
    if (!COUNTED.includes(mark.status)) continue;
    tally[mark.status as AttendanceMarkStatus] += 1;
  }
  return tally;
}

/**
 * BR-02.6a: (present + late) / (present + late + excused + absent).
 *
 * `excused` SENGAJA tetap di penyebut — BR-02.6b. Izin yang disetujui
 * melindungi murid dari kehangusan, TIDAK dari kelayakan naik level: murid
 * yang hadir 10 dari 40 sesi dengan 30 izin akan terbaca 100% kalau izin
 * dikeluarkan, dan itu jelas keliru.
 *
 * Penyebut nol menghasilkan null, bukan 0. Nol persen adalah pernyataan
 * bahwa murid tidak pernah hadir; "belum ada sesi apa pun" adalah pernyataan
 * yang berbeda, dan publikasi rapor memblokirnya (spec B4 §4.4).
 */
export function attendanceRecap(tally: AttendanceTally): AttendanceRecap {
  const sessionsAttended = tally.present + tally.late;
  const sessionsHeld = sessionsAttended + tally.excused + tally.absent;
  return {
    sessionsHeld,
    sessionsAttended,
    attendancePct:
      sessionsHeld === 0 ? null : roundTo2((sessionsAttended / sessionsHeld) * 100),
  };
}

export type CriterionScoreInput = { criterionId: number; score: number };

export type CriterionAverage = {
  criterionId: number;
  averageScore: number;
  sessionsScored: number;
};

/** Rata-rata per kriteria, terurut menaik menurut criterionId. */
export function averageByCriterion(
  scores: readonly CriterionScoreInput[],
): CriterionAverage[] {
  const buckets = new Map<number, { total: number; count: number }>();
  for (const row of scores) {
    const bucket = buckets.get(row.criterionId) ?? { total: 0, count: 0 };
    bucket.total += row.score;
    bucket.count += 1;
    buckets.set(row.criterionId, bucket);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([criterionId, bucket]) => ({
      criterionId,
      averageScore: roundTo2(bucket.total / bucket.count),
      sessionsScored: bucket.count,
    }));
}

/**
 * Rata-rata DARI rata-rata per kriteria, bobot sama antar kriteria.
 *
 * Bukan rata-rata seluruh nilai mentah: kriteria yang kebetulan lebih sering
 * dinilai akan jadi lebih berbobot, dan tidak ada seorang pun yang pernah
 * memutuskan itu.
 */
export function finalGradeFrom(
  averages: readonly CriterionAverage[],
): number | null {
  if (averages.length === 0) return null;
  const total = averages.reduce((sum, a) => sum + a.averageScore, 0);
  return roundTo2(total / averages.length);
}

/**
 * BR-02.6: kehadiran adalah satu-satunya gerbang kenaikan level di B4.
 * Nilai ditampilkan di rapor tapi tidak menentukan — ujian naik level formal
 * sengaja ditunda (spec payung §3.3).
 */
export function isEligible(
  attendancePct: number | null,
  thresholdPct: number,
): boolean | null {
  if (attendancePct === null) return null;
  return attendancePct >= thresholdPct;
}

export type PublishBlockers = {
  outstandingMakeups: Array<{ sessionId: string; scheduledAt: Date }>;
  staleSessions: Array<{ sessionId: string; scheduledAt: Date }>;
  studentsWithoutSessions: Array<{ studentId: string; fullName: string }>;
};

export function hasBlockers(blockers: PublishBlockers): boolean {
  return (
    blockers.outstandingMakeups.length > 0 ||
    blockers.staleSessions.length > 0 ||
    blockers.studentsWithoutSessions.length > 0
  );
}
