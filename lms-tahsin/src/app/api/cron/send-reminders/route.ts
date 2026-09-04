import type { NextRequest, NextResponse } from "next/server";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError } from "@/lib/auth-guard";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendDueReminders } from "@/lib/session-reminders";

export const dynamic = "force-dynamic";

/**
 * Pengingat sesi H-1 jam dan H-5 menit (roadmap item 15, BR-09).
 *
 * Perlu dipanggil tiap beberapa menit. Vercel Cron paket Hobby membatasi
 * frekuensi harian, jadi kalau belum berlangganan paket berbayar, panggil
 * endpoint ini dari pemicu luar (GitHub Actions terjadwal, cron-job.org,
 * dsb) dengan header Authorization: Bearer <CRON_SECRET>.
 *
 * Aman dipanggil sesering apa pun: unique (sessionId, kind) membuat satu
 * pengingat hanya terkirim sekali.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!(await isCronAuthorized(req))) {
      return apiError("Tidak berhak menjalankan cron", 401);
    }

    const startedAt = Date.now();
    const summary = await sendDueReminders();

    console.log(
      JSON.stringify({
        level: "info",
        msg: "send_reminders_done",
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
