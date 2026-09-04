import { z } from "zod";
import { LONG_LEAVE_MIN_DAYS, isValidLongLeaveRange } from "@/lib/teacher-leave";
import { LeaveType } from "@/generated/prisma/enums";

/** Pengajuan cuti guru (PRD F-7a, BR-06). */
export const createTeacherLeaveSchema = z
  .object({
    type: z.enum(LeaveType),
    reason: z.string().trim().min(1, "Alasan wajib diisi").max(500),
    startDate: z.iso.date("Format tanggal mulai tidak valid"),
    // Cuti panjang wajib punya tanggal akhir agar rentangnya bisa dinilai
    // dan supaya orang tua tahu kapan guru diharapkan kembali; cuti pendek
    // (batal per sesi lewat aksi status biasa) tidak memakai model ini
    // sama sekali, jadi endDate di sini selalu wajib.
    endDate: z.iso.date("Format tanggal selesai tidak valid"),
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
      });
      return;
    }
    if (
      value.type === LeaveType.long &&
      !isValidLongLeaveRange(value.startDate, value.endDate)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: `Cuti panjang minimal ${LONG_LEAVE_MIN_DAYS} hari. Untuk yang lebih singkat, batalkan sesi satu per satu lewat halaman Sesi.`,
      });
    }
  });

export type CreateTeacherLeaveInput = z.infer<typeof createTeacherLeaveSchema>;

export const reviewTeacherLeaveSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const leaveCoverageChoiceSchema = z
  .object({
    choice: z.enum(["substitute", "pause"]),
    substituteTeacherId: z.uuid("Guru pengganti tidak valid").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.choice === "substitute" && !value.substituteTeacherId) {
      ctx.addIssue({
        code: "custom",
        path: ["substituteTeacherId"],
        message: "Pilih guru pengganti",
      });
    }
  });

export type LeaveCoverageChoiceInput = z.infer<typeof leaveCoverageChoiceSchema>;
