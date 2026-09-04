import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getAdminUserIds } from "@/lib/notifications";
import { redactError, type CronJobName } from "@/lib/cron-runs";

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
          html: `<p>Job <strong>${job}</strong> gagal dijalankan.</p><pre>${redactError(error)}</pre><p>Cek Runtime Logs dan jalankan ulang manual bila perlu.</p>`,
        }),
      ),
  );
}

/**
 * Bungkus satu eksekusi cron: catat mulai, catat hasil, dan pada kegagalan
 * kirim email ke admin sebelum melempar ulang. Error ASLI TETAP dilempar
 * supaya response HTTP-nya 500 dan penjadwal tahu percobaannya gagal.
 *
 * PENTING: bookkeeping pada kegagalan (update baris CronRun jadi ok:false,
 * dan alertAdmins) masing-masing dibungkus try/catch SENDIRI-SENDIRI di
 * bawah. alertAdmins melakukan query ke database sendiri
 * (prisma.user.findMany) -- beda dengan sendEmail yang tidak pernah
 * melempar (lihat email.ts) -- jadi kalau database sedang down, error asli
 * dari `fn()` bisa saja "digantikan" oleh error koneksi baru yang muncul
 * saat mencoba menulis ke database yang sama. Itu justru menghilangkan
 * diagnosis yang NFR-3 ingin dijaga. Dengan membungkus bookkeeping secara
 * terpisah, kegagalan di salah satunya hanya dicatat lewat console.error
 * terstruktur dan TIDAK PERNAH menggantikan atau menelan error asli.
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
    try {
      await prisma.cronRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), ok: false, error: redactError(error) },
      });
    } catch (updateError) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "cron_run_update_failed",
          job,
          error: redactError(updateError),
        }),
      );
    }

    try {
      await alertAdmins(job, error);
    } catch (alertError) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "cron_alert_admins_failed",
          job,
          error: redactError(alertError),
        }),
      );
    }

    // Error asli -- BUKAN updateError/alertError -- yang wajib dilempar ulang.
    throw error;
  }
}
