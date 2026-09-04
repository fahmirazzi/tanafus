import type { NextRequest, NextResponse } from "next/server";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError } from "@/lib/auth-guard";
import { isCronAuthorized } from "@/lib/cron-auth";
import { recordCronRun } from "@/lib/cron-runs-recorder";
import { executeDueDeletions } from "@/lib/account-deletion-executor";

export const dynamic = "force-dynamic";

/**
 * Eksekusi anonimisasi akun yang tenggangnya sudah lewat (NFR-6).
 *
 * isCronAuthorized dicek DI LUAR recordCronRun supaya percobaan tanpa
 * otorisasi tidak ikut membuat baris CronRun, sama seperti cron lain.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!(await isCronAuthorized(req))) {
      return apiError("Tidak berhak menjalankan cron", 401);
    }

    const summary = await recordCronRun("process_deletions", () =>
      executeDueDeletions(new Date()),
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
