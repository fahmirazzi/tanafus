import { z } from "zod";

/**
 * Penilaian kohort satu sesi: seluruh roster kali seluruh kriteria dalam satu
 * kiriman (spec B4 §4.3), meniru attendanceSchema yang sudah ada.
 */
export const cohortGradesSchema = z.object({
  grades: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        criterionId: z.coerce.number().int().positive(),
        score: z.coerce.number().min(0, "Nilai minimal 0"),
      }),
    )
    .min(1, "Tidak ada nilai yang dikirim"),
});

/** Narasi guru + timpaan nilai akhir pada satu rapor (spec B4 §4.4). */
export const reportCardPatchSchema = z
  .object({
    teacherNote: z.union([z.string().trim().max(2000), z.literal("")]).optional(),
    finalGradeOverride: z.union([z.coerce.number().min(0).max(100), z.null()]).optional(),
    overrideReason: z.union([z.string().trim().max(500), z.literal("")]).optional(),
  })
  .refine(
    (v) =>
      v.finalGradeOverride === undefined ||
      v.finalGradeOverride === null ||
      Boolean(v.overrideReason && v.overrideReason.trim()),
    {
      // Menimpa nilai hasil hitungan adalah keputusan yang harus bisa
      // dipertanggungjawabkan ke orang tua, bukan angka yang muncul begitu saja.
      path: ["overrideReason"],
      error: "Alasan wajib diisi saat menimpa nilai akhir",
    },
  );

/** Penerbitan ulang menuntut konfirmasi eksplisit (spec B4 §4.4). */
export const publishReportCardsSchema = z.object({
  confirm: z.boolean().optional(),
});
