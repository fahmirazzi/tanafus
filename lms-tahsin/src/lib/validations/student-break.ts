import { z } from "zod";
import { SimpleApprovalStatus } from "@/generated/prisma/enums";

/** Pagar kewarasan: libur privat bukan mekanisme berhenti permanen. */
export const MAX_BREAK_DAYS = 180;

export const createStudentBreakSchema = z
  .object({
    studentId: z.uuid("Murid tidak valid"),
    teacherId: z.uuid("Guru tidak valid"),
    startDate: z.iso.date("Format tanggal mulai tidak valid"),
    endDate: z.iso.date("Format tanggal selesai tidak valid"),
    reason: z
      .union([
        z.string().trim().max(500, "Alasan maksimal 500 karakter"),
        z.literal(""),
      ])
      .optional(),
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
    const days =
      (Date.parse(`${value.endDate}T00:00:00Z`) -
        Date.parse(`${value.startDate}T00:00:00Z`)) /
        86_400_000 +
      1;
    if (days > MAX_BREAK_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: `Libur maksimal ${MAX_BREAK_DAYS} hari sekali pengajuan`,
      });
    }
  });

export type CreateStudentBreakInput = z.infer<typeof createStudentBreakSchema>;

export const reviewStudentBreakSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reviewNote: z
      .union([
        z.string().trim().max(500, "Catatan maksimal 500 karakter"),
        z.literal(""),
      ])
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "reject" && !value.reviewNote) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewNote"],
        message: "Alasan penolakan wajib diisi",
      });
    }
  });

export type ReviewStudentBreakInput = z.infer<typeof reviewStudentBreakSchema>;

export const BREAK_STATUS_LABEL: Record<SimpleApprovalStatus, string> = {
  [SimpleApprovalStatus.pending]: "Menunggu persetujuan",
  [SimpleApprovalStatus.approved]: "Disetujui",
  [SimpleApprovalStatus.rejected]: "Ditolak",
};
