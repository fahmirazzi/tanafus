import { prisma } from "@/lib/prisma";
import { hasRole, type SessionUser } from "@/lib/auth-guard";
import { RoleName } from "@/generated/prisma/enums";

/**
 * Murid yang boleh dilihat seorang pengguna non-admin (BR-10.1).
 *
 * Orang tua melihat anak-anaknya; murid yang login sendiri melihat dirinya.
 * Seseorang bisa saja keduanya, sehingga hasilnya dibersihkan dari duplikat.
 *
 * CATATAN SCHEMA: anak dari seorang parent dicari lewat parentId — lihat
 * catatan yang sama di auth-guard.ts.
 */
export async function viewableStudentIds(
  user: SessionUser,
): Promise<string[]> {
  const links = hasRole(user, RoleName.parent)
    ? await prisma.parentStudent.findMany({
        where: { parentId: user.id },
        select: { studentId: true },
      })
    : [];

  const ids = [
    ...(hasRole(user, RoleName.student) ? [user.id] : []),
    ...links.map((l) => l.studentId),
  ];
  return [...new Set(ids)];
}

/** Nama murid untuk daftar pilihan, terurut abjad. */
export async function listStudentsByIds(
  studentIds: readonly string[],
): Promise<{ id: string; fullName: string }[]> {
  if (studentIds.length === 0) return [];
  return prisma.user.findMany({
    where: { id: { in: [...studentIds] } },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}
