import { z } from "zod";

/** Batas panjang teks naratif; cukup panjang untuk catatan satu sesi. */
const NARRATIVE_MAX = 2000;

const narrative = z
  .union([
    z.string().trim().max(NARRATIVE_MAX, `Maksimal ${NARRATIVE_MAX} karakter`),
    z.literal(""),
  ])
  .optional();

/**
 * Feedback + rubrik penilaian per sesi (PRD F-4a & F-4b, roadmap item 18).
 *
 * Batas atas skor di sini hanya penjaga kasar; batas sebenarnya adalah
 * GradeCriterion.maxScore di database, dicek ulang oleh route karena
 * tiap kriteria boleh punya skala sendiri.
 */
export const sessionFeedbackSchema = z.object({
  grades: z
    .array(
      z.object({
        criterionId: z.coerce.number().int().positive(),
        score: z.coerce
          .number()
          .min(0, "Nilai minimal 0")
          .max(100, "Nilai maksimal 100"),
      }),
    )
    .min(1, "Isi nilai minimal satu kriteria"),
  strengths: narrative,
  improvements: narrative,
  nextTarget: narrative,
  // Audio koreksi (PRD F-4b) untuk sekarang berupa tautan yang guru tempel;
  // penyimpanan berkas belum ada di fase ini.
  audioNoteUrl: z
    .union([z.url("Tautan audio tidak valid").max(500), z.literal("")])
    .optional(),
});

export type SessionFeedbackInput = z.infer<typeof sessionFeedbackSchema>;
