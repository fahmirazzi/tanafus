import { z } from "zod";

const optionalText = (max: number, message: string) =>
  z.union([z.string().trim().max(max, message), z.literal("")]).optional();

/**
 * Field yang boleh diubah guru sendiri. revenueSharePct SENGAJA tidak ada
 * di sini — bagi hasil hanya boleh diubah admin (docs/02).
 */
export const teacherProfileSchema = z.object({
  bio: optionalText(1000, "Bio maksimal 1000 karakter"),
  qualifications: optionalText(1000, "Kualifikasi maksimal 1000 karakter"),
  sanadInfo: optionalText(1000, "Informasi sanad maksimal 1000 karakter"),
  specialties: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Spesialisasi tidak boleh kosong")
        .max(60, "Spesialisasi maksimal 60 karakter"),
    )
    .max(10, "Maksimal 10 spesialisasi")
    .optional(),
  acceptsPrivate: z.boolean().optional(),
  acceptingStudents: z.boolean().optional(),
  // z.literal("") harus di depan, kalau tidak z.coerce.number() akan
  // mengubah string kosong menjadi 0.
  yearsExperience: z
    .union([
      z.literal(""),
      z.coerce
        .number()
        .int("Pengalaman harus bilangan bulat tahun")
        .min(0, "Pengalaman tidak boleh negatif")
        .max(70, "Pengalaman maksimal 70 tahun"),
    ])
    .optional(),
});

export type TeacherProfileInput = z.infer<typeof teacherProfileSchema>;

/** BR-05.1: bagi hasil guru, default 60%. Hanya admin yang boleh mengubah. */
export const revenueShareSchema = z.object({
  revenueSharePct: z.coerce
    .number({ error: "Bagi hasil wajib diisi" })
    .min(0, "Bagi hasil minimal 0%")
    .max(100, "Bagi hasil maksimal 100%"),
});

export type RevenueShareInput = z.infer<typeof revenueShareSchema>;
