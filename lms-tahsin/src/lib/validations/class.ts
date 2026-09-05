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
