import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getAdminUserIds } from "@/lib/notifications";
import type { CronJobName } from "@/lib/cron-runs";

/** Kirim email kegagalan ke semua admin/super admin aktif yang punya email. */
async function alertAdmins(job: CronJobName, error: unknown): Promise<void> {
  const adminIds = await getAdminUserIds();
  if (adminIds.length === 0) return;

  const admins = await prisma.user.findMany({
    where: { id: { in: adminIds } },
    select: { email: true },
  });

  await Promise.all(
    admins
      .filter((a): a is { email: string } => Boolean(a.email))
      .map((admin) =>
        sendEmail({
          to: admin.email,
          subject: `[Tanafus] Cron gagal: ${job}`,
          html: `<p>Job <strong>${job}</strong> gagal dijalankan.</p><pre>${String(error)}</pre><p>Cek Runtime Logs dan jalankan ulang manual bila perlu.</p>`,
        }),
      ),
  );
}

/**
 * Bungkus satu eksekusi cron: catat mulai, catat hasil, dan pada kegagalan
 * kirim email ke admin sebelum melempar ulang. Error TETAP dilempar supaya
 * response HTTP-nya 500 dan penjadwal tahu percobaannya gagal.
 *
 * sendEmail tidak pernah melempar (lihat email.ts), jadi kegagalan kirim
 * email tidak akan menutupi error asli yang sedang dilaporkan.
 */
export async function recordCronRun<T>(
  job: CronJobName,
  fn: () => Promise<T>,
): Promise<T> {
  const run = await prisma.cronRun.create({
    data: { job },
    select: { id: true },
  });

  try {
    const result = await fn();
    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: true,
        summary: result as never,
      },
    });
    return result;
  } catch (error) {
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: String(error) },
    });
    await alertAdmins(job, error);
    throw error;
  }
}
