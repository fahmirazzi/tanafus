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
        // TIDAK memakai z.coerce di sini: badan permintaan ini JSON, bukan
        // form HTML, jadi tidak ada string yang perlu dikonversi. z.coerce
        // juga membuat Number(null) === 0 dan Number("") === 0 lolos diam-
        // diam sebagai nol — itu tepat kebalikan dari invarian rilis ini,
        // "sel kosong bukan nol" (lihat buildGradePayload di grade-form.ts,
        // yang sengaja menyaring sel kosong SEBELUM mengirim, bukan sesudah).
        // Kalau field ini dikoersi lagi demi "kenyamanan" nanti, jaminan itu
        // batal dari sisi API meskipun UI-nya sudah benar.
        criterionId: z.number().int().positive(),
        score: z.number().min(0, "Nilai minimal 0"),
      }),
    )
    .min(1, "Tidak ada nilai yang dikirim"),
});

/**
 * Narasi guru + timpaan nilai akhir pada satu rapor DRAFT (spec B4 §4.4).
 * Rapor yang sudah terbit dinilai publishedReportCardNoteSchema di bawah.
 */
export const reportCardPatchSchema = z
  .object({
    teacherNote: z.union([z.string().trim().max(2000), z.literal("")]).optional(),
    // TIDAK memakai z.coerce.number(): Number(null) adalah 0, sehingga cabang
    // angka pada z.union([z.coerce.number()..., z.null()]) lolos duluan
    // sebelum z.null() sempat dicoba — null (permintaan MENGHAPUS timpaan)
    // diam-diam berubah jadi 0 (nilai akhir NOL sungguhan tersimpan). Body
    // di sini JSON asli, bukan form HTML, jadi tidak ada string yang perlu
    // dikonversi; .nullable().optional() menjaga tiga keadaan tetap berbeda:
    // undefined (field tidak dikirim, PATCH parsial tidak menyentuhnya),
    // null (hapus timpaan), dan number (timpaan baru).
    finalGradeOverride: z.number().min(0).max(100).nullable().optional(),
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

/**
 * PATCH pada rapor yang SUDAH TERBIT: catatan guru, dan tidak ada yang lain.
 *
 * Skema terpisah, bukan reportCardPatchSchema yang dilonggarkan, dan `.strict()`
 * bukan kelalaian — pembekuan rapor tetap berlaku penuh untuk ANGKA. Kalau
 * klien mengirim finalGradeOverride/overrideReason ke rapor terbit, permintaan
 * itu DITOLAK, bukan diterima lalu diam-diam mengabaikan field-nya: guru yang
 * mengira baru saja mengubah nilai akhir sesudah terbit harus mendengarnya
 * sekarang, bukan menemukannya sendiri di PDF yang tidak berubah.
 *
 * teacherNote WAJIB ada di sini (tidak .optional()): satu-satunya alasan
 * memanggil PATCH pada rapor terbit adalah memperbaiki narasinya, jadi badan
 * kosong adalah kesalahan klien, bukan "PATCH parsial yang tak menyentuh apa
 * pun". String kosong tetap sah — ia berarti MENGHAPUS catatan, dan menghapus
 * catatan yang keliru adalah persis salah satu perbaikan yang dibolehkan.
 */
export const publishedReportCardNoteSchema = z
  .object({
    teacherNote: z.union([z.string().trim().max(2000), z.literal("")]),
  })
  .strict();

/** Penerbitan ulang menuntut konfirmasi eksplisit (spec B4 §4.4). */
export const publishReportCardsSchema = z.object({
  confirm: z.boolean().optional(),
});
