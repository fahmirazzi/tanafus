/**
 * Agregasi progres murid privat (PRD F-4d, roadmap item 19).
 *
 * Sama seperti billing.ts, tidak ada query di sini: halaman yang membaca
 * SessionGrade lalu menyerahkan barisnya. Grafiknya digambar sebagai SVG
 * inline, jadi fungsi kedua di bawah menyiapkan koordinatnya.
 */

export type GradeRow = {
  sessionId: string;
  scheduledAt: Date;
  criterionId: number;
  criterionName: string;
  score: number;
};

export type ProgressPoint = {
  sessionId: string;
  scheduledAt: Date;
  score: number;
};

export type ProgressSeries = {
  criterionId: number;
  criterionName: string;
  points: ProgressPoint[];
  latest: number;
  average: number;
  /** Selisih dari penilaian sebelumnya; null bila baru satu kali dinilai. */
  delta: number | null;
};

/** Satu deret per kriteria rubrik, terurut dari sesi terlama ke terbaru. */
export function buildProgressSeries(rows: readonly GradeRow[]): ProgressSeries[] {
  const byCriterion = new Map<number, GradeRow[]>();
  for (const row of rows) {
    const bucket = byCriterion.get(row.criterionId);
    if (bucket) bucket.push(row);
    else byCriterion.set(row.criterionId, [row]);
  }

  // Urutan kriteria mengikuti id — itu urutan rubrik saat di-seed
  // (Makharijul Huruf, Sifatul Huruf, Tajwid, Kelancaran), bukan abjad.
  const criterionIds = [...byCriterion.keys()].sort((a, b) => a - b);

  return criterionIds.map((criterionId) => {
    const bucket = [...(byCriterion.get(criterionId) ?? [])].sort(
      (a, b) =>
        a.scheduledAt.getTime() - b.scheduledAt.getTime() ||
        a.sessionId.localeCompare(b.sessionId),
    );

    const points: ProgressPoint[] = bucket.map((row) => ({
      sessionId: row.sessionId,
      scheduledAt: row.scheduledAt,
      score: row.score,
    }));

    const scores = points.map((p) => p.score);
    const latest = scores[scores.length - 1];
    const previous = scores.length > 1 ? scores[scores.length - 2] : null;
    const total = scores.reduce((sum, score) => sum + score, 0);

    return {
      criterionId,
      criterionName: bucket[0].criterionName,
      points,
      latest,
      average: round1(total / scores.length),
      delta: previous === null ? null : round1(latest - previous),
    };
  });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Koordinat untuk <polyline points="...">.
 *
 * Titik pertama menempel di tepi kiri dan terakhir di tepi kanan, supaya
 * lebar grafik selalu terpakai penuh berapa pun jumlah sesinya. Satu titik
 * diletakkan di tengah karena garis dari tepi ke tepi tidak punya makna.
 * Sumbu y SVG tumbuh ke bawah, jadi nilai tinggi justru y kecil.
 */
export function toPolylinePoints(
  scores: readonly number[],
  box: { width: number; height: number; maxScore: number },
): string {
  if (scores.length === 0) return "";

  return scores
    .map((score, index) => {
      const x =
        scores.length === 1
          ? box.width / 2
          : (index / (scores.length - 1)) * box.width;
      const ratio = box.maxScore > 0 ? score / box.maxScore : 0;
      const y = box.height - ratio * box.height;
      return `${trim(x)},${trim(y)}`;
    })
    .join(" ");
}

/** 33.333333 -> "33.33", 40 -> "40"; menjaga atribut SVG tetap pendek. */
function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}
