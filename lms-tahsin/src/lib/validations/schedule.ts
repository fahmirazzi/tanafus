import { z } from "zod";

/** 0 = Minggu .. 6 = Sabtu, mengikuti komentar di schema.prisma. */
export const DAY_OF_WEEK_LABEL: Record<number, string> = {
  0: "Ahad",
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
};

export const DAY_OF_WEEK_VALUES = [0, 1, 2, 3, 4, 5, 6] as const;

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

const startTimeField = z
  .string()
  .trim()
  .regex(TIME_OF_DAY, "Jam mulai harus format 16:00");

const optionalDate = z
  .union([z.iso.date("Format tanggal tidak valid"), z.literal("")])
  .optional();

const optionalUrl = z
  .union([z.url("Tautan tidak valid").max(500), z.literal("")])
  .optional();

const baseSchedule = {
  dayOfWeek: z.coerce
    .number()
    .int()
    .min(0, "Hari tidak valid")
    .max(6, "Hari tidak valid"),
  startTime: startTimeField,
  durationMinutes: z.coerce
    .number()
    .int()
    .min(15, "Durasi minimal 15 menit")
    .max(240, "Durasi maksimal 240 menit"),
  meetingUrl: optionalUrl,
  effectiveFrom: optionalDate,
  effectiveUntil: optionalDate,
};

/** Rentang berlaku harus masuk akal: selesai tidak boleh mendahului mulai. */
function checkRange(
  value: { effectiveFrom?: string; effectiveUntil?: string },
  ctx: z.RefinementCtx,
): void {
  if (
    value.effectiveFrom &&
    value.effectiveUntil &&
    value.effectiveUntil < value.effectiveFrom
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveUntil"],
      message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
    });
  }
}

export const createScheduleSchema = z
  .object({
    studentId: z.uuid("Murid tidak valid"),
    // Hanya admin yang boleh mengisi ini; guru selalu memakai dirinya sendiri.
    teacherId: z.union([z.uuid("Guru tidak valid"), z.literal("")]).optional(),
    ...baseSchedule,
  })
  .superRefine(checkRange);

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = z
  .object({
    ...baseSchedule,
    isActive: z.boolean().optional(),
  })
  .superRefine(checkRange);

export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

export const scheduleListQuerySchema = z.object({
  studentId: z.union([z.uuid(), z.literal("")]).optional(),
  includeInactive: z.enum(["1", "0"]).optional(),
});
