import { z } from "zod";
import { Gender, Relation } from "@/generated/prisma/enums";

/** NFR-2: password minimum 8 karakter. */
const passwordField = z
  .string()
  .min(8, "Kata sandi minimal 8 karakter")
  .max(72, "Kata sandi maksimal 72 karakter");

const relationValues = Object.values(Relation) as [Relation, ...Relation[]];
const genderValues = Object.values(Gender) as [Gender, ...Gender[]];

export const loginSchema = z.object({
  email: z.email("Format email tidak valid"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Anak: password OPSIONAL.
 * Diisi  -> anak bisa login sendiri (isActive true).
 * Kosong -> hash acak + isActive false, akses lewat akun orang tua (NFR-6).
 */
export const childSchema = z.object({
  fullName: z.string().trim().min(2, "Nama anak minimal 2 karakter").max(120),
  gender: z.enum(genderValues).optional(),
  birthDate: z.iso.date("Format tanggal lahir tidak valid").optional(),
  password: z.union([passwordField, z.literal("")]).optional(),
});

export const registerParentSchema = z
  .object({
    fullName: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
    email: z.email("Format email tidak valid"),
    phone: z
      .string()
      .trim()
      .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Format nomor HP tidak valid")
      .optional()
      .or(z.literal("")),
    password: passwordField,
    confirmPassword: z.string(),
    relation: z.enum(relationValues, {
      error: "Hubungan dengan anak wajib dipilih",
    }),
    children: z
      .array(childSchema)
      .min(1, "Minimal satu data anak wajib diisi")
      .max(10, "Maksimal 10 anak per pendaftaran"),
    agreePrivacy: z.literal(true, {
      error: "Anda harus menyetujui kebijakan privasi",
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });

export type RegisterParentInput = z.infer<typeof registerParentSchema>;
