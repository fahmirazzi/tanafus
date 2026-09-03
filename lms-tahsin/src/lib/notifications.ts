import { prisma } from "@/lib/prisma";
import { emailTemplate, sendEmailToMany } from "@/lib/email";
import { RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Notifikasi in-app (BR-09), channel default "in_app".
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

/** Alamat email pengguna aktif dari sekumpulan id, untuk event BR-09 yang
 * wajib lewat email selain in-app. Pengguna tanpa email atau nonaktif
 * dilewati diam-diam — bukan kegagalan, hanya tidak ada tujuan kirim. */
export async function getEmailAddresses(
  userIds: readonly string[],
  client: Client = prisma,
): Promise<string[]> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return [];

  const users = await client.user.findMany({
    where: { id: { in: ids }, isActive: true, NOT: { email: null } },
    select: { email: true },
  });
  return users
    .map((u) => u.email)
    .filter((email): email is string => email !== null);
}

/**
 * Kirim email untuk satu peristiwa ke sekumpulan pengguna.
 *
 * WAJIB dipanggil setelah transaksi database yang memicunya sudah commit,
 * tidak pernah dari dalam `prisma.$transaction(...)` — mengirim email
 * adalah panggilan jaringan ke Resend, dan menahannya di dalam transaksi
 * berarti kegagalan atau kelambatan Resend bisa membuat transaksi database
 * yang sudah sah (sesi ditandai selesai, invoice diterbitkan) ikut gagal
 * atau timeout karenanya. Lihat catatan yang sama di email.ts.
 *
 * Tidak pernah melempar, sejalan dengan sendEmail: pemanggil tidak perlu
 * membungkusnya dengan try/catch sendiri.
 */
export async function sendEventEmail(
  userIds: readonly string[],
  content: { subject: string; title: string; body: string },
): Promise<void> {
  try {
    const emails = await getEmailAddresses(userIds);
    if (emails.length === 0) return;

    await sendEmailToMany(emails, (to) => ({
      to,
      subject: content.subject,
      html: emailTemplate({ title: content.title, body: content.body }),
    }));
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "send_event_email_failed",
        subject: content.subject,
        error: String(error),
      }),
    );
  }
}
