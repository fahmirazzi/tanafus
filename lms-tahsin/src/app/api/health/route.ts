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
    const jobs: CronJobName[] = [
      "generate_sessions",
      "monthly_invoices",
      "billing_overdue",
      "send_reminders",
      "process_deletions",
    ];

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

    const crons = Object.fromEntries(
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
