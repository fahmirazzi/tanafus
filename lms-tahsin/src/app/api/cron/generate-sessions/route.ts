import type { NextRequest, NextResponse } from "next/server";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError } from "@/lib/auth-guard";
import { isCronAuthorized } from "@/lib/cron-auth";
import { generateUpcomingSessions } from "@/lib/session-generator";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!(await isCronAuthorized(req))) {
      return apiError("Tidak berhak menjalankan cron", 401);
    }

    const startedAt = Date.now();
    const summary = await generateUpcomingSessions();

    console.log(
      JSON.stringify({
        level: "info",
        msg: "generate_sessions_done",
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
