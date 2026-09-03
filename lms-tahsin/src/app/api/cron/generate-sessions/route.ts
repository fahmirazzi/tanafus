import type { NextRequest, NextResponse } from "next/server";
import { apiError, apiOk } from "@/lib/api";
import { getSessionUser, handleApiError, isAdmin } from "@/lib/auth-guard";
import { generateUpcomingSessions } from "@/lib/session-generator";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron mengirim header Authorization: Bearer <CRON_SECRET>.
 * Admin yang sedang login juga boleh memicunya manual — berguna untuk
 * menambal jendela setelah cron gagal, tanpa perlu membocorkan secret.
 *
 * Kalau CRON_SECRET belum diset, jalur bearer ditutup rapat; endpoint ini
 * TIDAK pernah boleh terbuka tanpa otentikasi.
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    if (header === `Bearer ${secret}`) return true;
  }

  const user = await getSessionUser();
  return user !== null && isAdmin(user);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!(await isAuthorized(req))) {
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
