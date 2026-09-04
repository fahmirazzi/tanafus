import { prisma } from "@/lib/prisma";
import { isCronStale, type CronJobName } from "@/lib/cron-runs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** NFR-4: health check untuk monitoring eksternal (UptimeRobot). */
export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;

    // NFR-4: health check ikut melaporkan "cron terakhir jalan", bukan hanya
    // koneksi database. Cron yang mati adalah kegagalan yang paling lama
    // tidak terdeteksi di sistem ini — kalendernya cuma berhenti terisi.
    //
    // Kesegaran cron adalah DETAIL DIAGNOSTIK, bukan sinyal liveness. Blok
    // try/catch ini sengaja terpisah dari probe `SELECT 1` di atas: kalau
    // query CronRun gagal (mis. tabelnya belum ada karena `prisma migrate
    // deploy` belum dijalankan setelah deploy — lihat docs/12-onboarding.md
    // §2 step 1), `ok`/`db` TIDAK BOLEH ikut melaporkan down. Database
    // sudah terbukti hidup lewat SELECT 1 satu baris di atas; kegagalan di
    // sini murni soal cron, dilaporkan lewat `crons: null`.
    const jobs: CronJobName[] = [
      "generate_sessions",
      "monthly_invoices",
      "billing_overdue",
      "send_reminders",
      "process_deletions",
    ];

    let crons: Record<string, { lastSuccessAt: string | null; stale: boolean }> | null;
    try {
      const now = new Date();
      const lastRuns = await Promise.all(
        jobs.map((job) =>
          prisma.cronRun.findFirst({
            where: { job, ok: true },
            orderBy: { startedAt: "desc" },
            select: { startedAt: true },
          }),
        ),
      );

      crons = Object.fromEntries(
        jobs.map((job, index) => {
          const lastSuccessAt = lastRuns[index]?.startedAt ?? null;
          return [
            job,
            {
              lastSuccessAt: lastSuccessAt?.toISOString() ?? null,
              stale: isCronStale(lastSuccessAt, job, now),
            },
          ];
        }),
      );
    } catch (cronError) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "health_crons_unavailable",
          error: String(cronError),
        }),
      );
      crons = null;
    }

    return NextResponse.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      crons,
    });
  } catch (error) {
    console.error(
      JSON.stringify({ level: "error", msg: "health_db_down", error: String(error) }),
    );
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
