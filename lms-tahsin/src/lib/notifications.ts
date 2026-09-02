import { prisma } from "@/lib/prisma";
import { RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Notifikasi in-app (BR-09). Email lewat Resend menyusul di Sprint 5, jadi
 * untuk sekarang semua notifikasi memakai channel default "in_app".
 */
export type NotificationDraft = {
  userIds: readonly string[];
  type: string;
  title: string;
  body?: string;
  data?: Prisma.InputJsonValue;
};

type Client = Prisma.TransactionClient | typeof prisma;

export async function createNotifications(
  client: Client,
  draft: NotificationDraft,
): Promise<void> {
  const recipients = [...new Set(draft.userIds)].filter(Boolean);
  if (recipients.length === 0) return;

  await client.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: draft.type,
      title: draft.title,
      body: draft.body,
      data: draft.data,
    })),
  });
}

/** Admin dan super admin yang masih aktif — penerima notifikasi operasional. */
export async function getAdminUserIds(client: Client = prisma): Promise<string[]> {
  const admins = await client.user.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          role: { name: { in: [RoleName.super_admin, RoleName.admin] } },
        },
      },
    },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/**
 * Murid berikut orang tuanya. Dipakai untuk event yang menurut BR-09
 * ditujukan ke "murid + parent".
 *
 * CATATAN SCHEMA: relasi ParentStudent terbalik dari intuisi — baris anak
 * dari seorang parent dicari lewat where: { studentId }, lalu parentId-nya
 * yang diambil. Lihat catatan yang sama di auth-guard.ts.
 */
export async function getStudentAudienceIds(
  studentId: string,
  client: Client = prisma,
): Promise<string[]> {
  const links = await client.parentStudent.findMany({
    where: { studentId },
    select: { parentId: true },
  });
  return [studentId, ...links.map((l) => l.parentId)];
}
