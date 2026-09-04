import { z } from "zod";
import { TeacherRequestStatus } from "@/generated/prisma/enums";

export const DAY_KEYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABEL: Record<DayKey, string> = {
  mon: "Senin",
  tue: "Selasa",
  wed: "Rabu",
  thu: "Kamis",
  fri: "Jumat",
  sat: "Sabtu",
  sun: "Ahad",
};

const TIME_RANGE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Disimpan sebagai array {day, range} lalu dikelompokkan jadi
 * {mon: ["15:00-17:00"]} sebelum masuk kolom Json (lihat schema.prisma).
 * Array lebih mudah divalidasi ketat daripada record dengan kunci dinamis.
 */
const preferredTimeSchema = z
  .object({
    day: z.enum(DAY_KEYS),
    range: z
      .string()
      .trim()
      .regex(TIME_RANGE, "Format jam harus seperti 15:00-17:00"),
  })
  .refine(
    (v) => {
      const [start, end] = v.range.split("-");
      return start < end;
    },
    { message: "Jam mulai harus lebih awal dari jam selesai", path: ["range"] },
  );

export const createTeacherRequestSchema = z.object({
  studentId: z.uuid("Murid tidak valid"),
  // NULL = percayakan penempatan ke admin (BR-08.1).
  teacherId: z.union([z.uuid("Guru tidak valid"), z.literal("")]).optional(),
  preferredDurations: z
    .array(z.coerce.number().int().min(15).max(240))
    .min(1, "Pilih minimal satu durasi")
    .max(5, "Maksimal 5 pilihan durasi"),
  preferredTimes: z
    .array(preferredTimeSchema)
    .max(14, "Maksimal 14 rentang waktu")
    .optional(),
  note: z
    .union([z.string().trim().max(1000, "Catatan maksimal 1000 karakter"), z.literal("")])
    .optional(),
});

export type CreateTeacherRequestInput = z.infer<
  typeof createTeacherRequestSchema
>;

/** Kelompokkan ke bentuk yang disimpan di kolom Json. */
export function groupPreferredTimes(
  entries: { day: DayKey; range: string }[] | undefined,
): Record<string, string[]> | null {
  if (!entries || entries.length === 0) return null;
  const grouped: Record<string, string[]> = {};
  for (const entry of entries) {
    (grouped[entry.day] ??= []).push(entry.range);
  }
  return grouped;
}

export const reviewTeacherRequestSchema = z
  .object({
    action: z.enum(["approve", "reject", "waitlist"]),
    // Hanya dipakai admin saat request datang tanpa guru pilihan.
    teacherId: z.union([z.uuid("Guru tidak valid"), z.literal("")]).optional(),
    level: z
      .union([z.string().trim().max(120, "Level maksimal 120 karakter"), z.literal("")])
      .optional(),
    rejectReason: z
      .union([z.string().trim().max(500, "Alasan maksimal 500 karakter"), z.literal("")])
      .optional(),
  })
  .superRefine((value, ctx) => {
    // Parent berhak tahu kenapa ditolak (skenario PRD F-1).
    if (value.action === "reject" && !value.rejectReason) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectReason"],
        message: "Alasan penolakan wajib diisi",
      });
    }
  });

export type ReviewTeacherRequestInput = z.infer<
  typeof reviewTeacherRequestSchema
>;

const statusValues = Object.values(TeacherRequestStatus) as [
  TeacherRequestStatus,
  ...TeacherRequestStatus[],
];

export const teacherRequestListQuerySchema = z.object({
  status: z.enum(statusValues).optional(),
});

export const REQUEST_STATUS_LABEL: Record<TeacherRequestStatus, string> = {
  [TeacherRequestStatus.pending]: "Menunggu konfirmasi",
  [TeacherRequestStatus.approved]: "Diterima",
  [TeacherRequestStatus.rejected]: "Ditolak",
  [TeacherRequestStatus.waitlisted]: "Daftar tunggu",
};
