import type { NextRequest, NextResponse } from "next/server";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError } from "@/lib/auth-guard";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runMonthlyBundle } from "@/lib/invoice-issuer";

export const dynamic = "force-dynamic";

/**
 * Bundel tagihan bulanan (roadmap item 21, BR-04.3b).
 *
 * Dijadwalkan 01.00 UTC tanggal 1 — 08.00 WIB di hari yang sama, sehingga
 * "tanggal 1" pada jadwal Vercel dan "tanggal 1" dalam kalender lembaga
 * menunjuk hari yang sama. Aman dipanggil kapan saja dan
 * sesering apa pun: charge yang sudah masuk invoice tidak pernah ditagih
 * kedua kali. Kalau satu jalan terlewat, jalan berikutnya menyusulkannya.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!(await isCronAuthorized(req))) {
      return apiError("Tidak berhak menjalankan cron", 401);
    }

    const startedAt = Date.now();
    const summary = await runMonthlyBundle();

    console.log(
      JSON.stringify({
        level: "info",
        msg: "monthly_invoices_done",
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
