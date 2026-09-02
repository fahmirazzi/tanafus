import { z } from "zod";
import {
  BillingPreference,
  Gender,
  Relation,
  RoleName,
} from "@/generated/prisma/enums";

const roleValues = Object.values(RoleName) as [RoleName, ...RoleName[]];
const genderValues = Object.values(Gender) as [Gender, ...Gender[]];
const relationValues = Object.values(Relation) as [Relation, ...Relation[]];
const billingValues = Object.values(BillingPreference) as [
  BillingPreference,
  ...BillingPreference[],
];

/** NFR-2: password minimum 8 karakter. */
const passwordField = z
  .string()
  .min(8, "Kata sandi minimal 8 karakter")
  .max(72, "Kata sandi maksimal 72 karakter");

/**
 * Form HTML mengirim field kosong sebagai "" (bukan undefined), jadi setiap
 * field opsional harus menerima keduanya. Normalisasi ke null dilakukan di
 * lib/users.ts sebelum menyentuh Prisma.
 */
const optionalEmail = z
  .union([z.email("Format email tidak valid"), z.literal("")])
  .optional();

const optionalPhone = z
  .union([
    z
      .string()
      .trim()
      .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Format nomor HP tidak valid"),
    z.literal(""),
  ])
  .optional();

const optionalText = (max: number, message: string) =>
  z.union([z.string().trim().max(max, message), z.literal("")]).optional();

const optionalBirthDate = z
  .union([z.iso.date("Format tanggal lahir tidak valid"), z.literal("")])
  .optional();

export const userListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(roleValues).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

const profileFields = {
  fullName: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(120, "Nama maksimal 120 karakter"),
  email: optionalEmail,
  phone: optionalPhone,
  gender: z.union([z.enum(genderValues), z.literal("")]).optional(),
  birthDate: optionalBirthDate,
  address: optionalText(500, "Alamat maksimal 500 karakter"),
  billingPreference: z.enum(billingValues).optional(),
};

export const createUserSchema = z
  .object({
    ...profileFields,
    password: passwordField,
    roles: z.array(z.enum(roleValues)).min(1, "Minimal satu role wajib dipilih"),
  })
  .superRefine((value, ctx) => {
    // Login memakai email (lihat auth.ts), jadi akun tanpa email tidak akan
    // pernah bisa masuk. Hanya murid yang boleh begitu — aksesnya lewat
    // akun orang tua (NFR-6).
    const studentOnly = value.roles.every((r) => r === RoleName.student);
    if (!studentOnly && !value.email) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Email wajib diisi untuk role selain murid",
      });
    }
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Role diubah lewat endpoint terpisah supaya aturan pengamannya tidak tercampur. */
export const updateUserSchema = z.object({
  ...profileFields,
  isActive: z.boolean().optional(),
  password: z.union([passwordField, z.literal("")]).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const setRolesSchema = z.object({
  roles: z.array(z.enum(roleValues)).min(1, "Minimal satu role wajib dipilih"),
});

export const linkChildSchema = z.object({
  studentId: z.uuid("Murid tidak valid"),
  relation: z.enum(relationValues, { error: "Hubungan wajib dipilih" }),
  isPrimary: z.boolean().optional(),
});

export type LinkChildInput = z.infer<typeof linkChildSchema>;
