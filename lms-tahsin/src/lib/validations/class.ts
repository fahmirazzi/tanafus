import { z } from "zod";

/** Masukan modul kelas reguler B1 (spec B1 §3, §6). */

const name = z.string().trim().min(2, "Nama minimal 2 karakter").max(120);

export const courseSchema = z.object({
  name,
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung")
    .max(120),
  description: z.union([z.string().trim().max(1000), z.literal("")]).optional(),
  levelNumber: z.coerce.number().int().min(0).max(50).optional(),
  attendanceThresholdPct: z.coerce
    .number()
    .min(0, "Ambang kehadiran minimal 0")
    .max(100, "Ambang kehadiran maksimal 100")
    .default(75),
});

export const moduleSchema = z.object({
  title: name,
  orderIndex: z.coerce.number().int().min(0),
});

export const lessonSchema = z.object({
  moduleId: z.string().uuid("Modul tidak valid"),
  title: name,
  orderIndex: z.coerce.number().int().min(0),
  summary: z.union([z.string().trim().max(1000), z.literal("")]).optional(),
});

export const periodSchema = z
  .object({
    name,
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    error: "Tanggal selesai tidak boleh sebelum tanggal mulai",
  });

export const classGroupSchema = z.object({
  courseId: z.string().uuid("Course tidak valid"),
  periodId: z.string().uuid("Periode tidak valid"),
  teacherId: z.string().uuid("Guru tidak valid"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  audience: z.enum(["children", "adult"], { error: "Audience wajib dipilih" }),
  capacity: z.coerce.number().int().min(1).max(100).default(15),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  honorPerSession: z.coerce.number().min(0, "Honor tidak boleh negatif"),
});

export const classScheduleSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam harus format HH:MM"),
  durationMinutes: z.coerce.number().int().min(15).max(300),
  meetingUrl: z.union([z.string().trim().url("URL tidak valid"), z.literal("")]).optional(),
});

export const enrollmentSchema = z.object({
  studentId: z.string().uuid("Murid tidak valid"),
});
