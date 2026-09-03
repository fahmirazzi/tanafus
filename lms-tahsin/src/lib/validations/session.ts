import { z } from "zod";
import { SessionStatus } from "@/generated/prisma/enums";

/**
 * Status yang masih "menduduki" slot waktu. Sesi yang dibatalkan atau
 * sudah dipindah tidak lagi memakan waktu guru maupun murid, jadi tidak
 * ikut dihitung saat mencari bentrok.
 */
export const OCCUPYING_STATUSES: SessionStatus[] = [
  SessionStatus.scheduled,
  SessionStatus.in_progress,
  SessionStatus.completed,
  SessionStatus.completed_absent,
  SessionStatus.excused,
];

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  [SessionStatus.scheduled]: "Terjadwal",
  [SessionStatus.in_progress]: "Berlangsung",
  [SessionStatus.completed]: "Selesai",
  [SessionStatus.completed_absent]: "Selesai (murid bolos)",
  [SessionStatus.cancelled_student]: "Dibatalkan murid",
  [SessionStatus.cancelled_teacher]: "Dibatalkan guru",
  [SessionStatus.cancelled_institution]: "Dibatalkan lembaga",
  [SessionStatus.rescheduled]: "Dipindah",
  [SessionStatus.excused]: "Izin",
};

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createOneTimeSessionSchema = z.object({
  studentId: z.uuid("Murid tidak valid"),
  // Hanya admin yang mengisi ini; guru selalu memakai dirinya sendiri.
  teacherId: z.union([z.uuid("Guru tidak valid"), z.literal("")]).optional(),
  date: z.iso.date("Format tanggal tidak valid"),
  startTime: z
    .string()
    .trim()
    .regex(TIME_OF_DAY, "Jam mulai harus format 16:00"),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(15, "Durasi minimal 15 menit")
    .max(240, "Durasi maksimal 240 menit"),
  meetingUrl: z
    .union([z.url("Tautan tidak valid").max(500), z.literal("")])
    .optional(),
  notes: z
    .union([z.string().trim().max(1000, "Catatan maksimal 1000 karakter"), z.literal("")])
    .optional(),
});

export type CreateOneTimeSessionInput = z.infer<
  typeof createOneTimeSessionSchema
>;

export const sessionListQuerySchema = z.object({
  from: z.iso.date("Format tanggal tidak valid").optional(),
  to: z.iso.date("Format tanggal tidak valid").optional(),
  studentId: z.union([z.uuid(), z.literal("")]).optional(),
});

/**
 * Pindah jadwal sesi (PRD F-2, item 12). Durasi opsional: memindahkan sesi
 * biasanya hanya menggeser waktu, bukan mengubah panjang belajarnya.
 */
export const rescheduleSessionSchema = z.object({
  date: z.iso.date("Format tanggal tidak valid"),
  startTime: z
    .string()
    .trim()
    .regex(TIME_OF_DAY, "Jam mulai harus format 16:00"),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(15, "Durasi minimal 15 menit")
    .max(240, "Durasi maksimal 240 menit")
    .optional(),
});

export type RescheduleSessionInput = z.infer<typeof rescheduleSessionSchema>;
