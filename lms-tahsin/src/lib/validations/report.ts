import { z } from "zod";

/** Rentang laporan CSV (roadmap item 28). Wajib, tidak seperti daftar sesi
 * biasa yang punya default — laporan tanpa rentang jelas gampang salah
 * unduh "semua data sejak awal lembaga berdiri" tanpa sadar. */
export const sessionsReportQuerySchema = z
  .object({
    from: z.iso.date("Format tanggal mulai tidak valid"),
    to: z.iso.date("Format tanggal selesai tidak valid"),
  })
  .superRefine((value, ctx) => {
    if (value.to < value.from) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
      });
      return;
    }
    const days =
      (Date.parse(`${value.to}T00:00:00Z`) -
        Date.parse(`${value.from}T00:00:00Z`)) /
        86_400_000 +
      1;
    if (days > 366) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "Rentang laporan maksimal 366 hari sekali unduh",
      });
    }
  });

export type SessionsReportQuery = z.infer<typeof sessionsReportQuerySchema>;
