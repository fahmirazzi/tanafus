import { z } from "zod";
import { SimpleApprovalStatus } from "@/generated/prisma/enums";

/** Usulan reschedule dari orang tua/murid (PRD F-2, roadmap DoD F-8). */

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createRescheduleRequestSchema = z.object({
  date: z.iso.date("Format tanggal tidak valid"),
  startTime: z
    .string()
    .trim()
    .regex(TIME_OF_DAY, "Jam mulai harus format 16:00"),
  reason: z
    .union([
      z.string().trim().max(500, "Alasan maksimal 500 karakter"),
      z.literal(""),
    ])
    .optional(),
});

export type CreateRescheduleRequestInput = z.infer<
  typeof createRescheduleRequestSchema
>;

export const reviewRescheduleRequestSchema = z
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

export type ReviewRescheduleRequestInput = z.infer<
  typeof reviewRescheduleRequestSchema
>;

export const RESCHEDULE_REQUEST_STATUS_LABEL: Record<
  SimpleApprovalStatus,
  string
> = {
  [SimpleApprovalStatus.pending]: "Menunggu persetujuan",
  [SimpleApprovalStatus.approved]: "Disetujui",
  [SimpleApprovalStatus.rejected]: "Ditolak",
};
