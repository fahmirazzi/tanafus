import type { NextRequest, NextResponse } from "next/server";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError } from "@/lib/auth-guard";
import { runOverdueSweep } from "@/lib/billing-overdue";
import { isCronAuthorized } from "@/lib/cron-auth";
import { recordCronRun } from "@/lib/cron-runs-recorder";

export const dynamic = "force-dynamic";

/**
 * Sapuan harian keterlambatan bayar dan suspensi (roadmap item 24, PRD F-5e).
 *
 * Menandai invoice yang lewat jatuh tempo, lalu menyuspend murid yang
 * tunggakannya melewati 14 hari. Keduanya idempotent, jadi pemanggilan
 * berulang di hari yang sama tidak menghasilkan notifikasi ganda.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!(await isCronAuthorized(req))) {
      return apiError("Tidak berhak menjalankan cron", 401);
    }

    const startedAt = Date.now();
    const summary = await recordCronRun("billing_overdue", () =>
      runOverdueSweep(),
    );

    console.log(
      JSON.stringify({
        level: "info",
        msg: "billing_overdue_done",
        durationMs: Date.now() - startedAt,
        ...summary,
      }),
    );

    return apiOk(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Vercel Cron memanggil dengan GET; perilakunya sama persis. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
