import { RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Syarat sebuah TeacherProfile boleh muncul sebagai guru privat.
 *
 * Role WAJIB ikut dicek: mencabut role teacher lewat /api/users/[id]/roles
 * tidak menghapus baris TeacherProfile, jadi tanpa filter ini mantan guru
 * tetap tampil di direktori publik dan tetap bisa dipilih di formulir
 * pendaftaran — padahal POST /api/teacher-requests akan menolaknya.
 *
 * Dipakai bersama oleh direktori publik, halaman profil publik, pemilih guru
 * di pendaftaran orang tua, dan pemilih guru di review admin, supaya keempat
 * query tidak bisa menyimpang satu sama lain.
 */
export const PUBLIC_TEACHER_WHERE = {
  acceptsPrivate: true,
  user: {
    isActive: true,
    roles: { some: { role: { name: RoleName.teacher } } },
  },
} satisfies Prisma.TeacherProfileWhereInput;
