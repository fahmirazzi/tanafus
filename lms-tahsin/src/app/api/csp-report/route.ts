import type { NextRequest, NextResponse } from "next/server";
import { apiOk } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Batas ukuran body laporan yang ikut ditulis ke log terstruktur. */
const MAX_LOGGED_BODY_LENGTH = 2000;

/**
 * Penerima laporan pelanggaran CSP (NFR-2, FIX 5).
 *
 * Endpoint ini SENGAJA tidak butuh sesi dan tidak menyentuh database —
 * browser pengguna yang mengirim laporan (lewat `report-uri` di
 * security-headers.ts) tidak pernah membawa cookie sesi untuk permintaan
 * semacam ini, dan tidak ada cara memverifikasi pengirimnya selain memang
 * membiarkannya terbuka, persis seperti webhook Midtrans diverifikasi lewat
 * jalurnya sendiri (di sini: tidak ada jalur, karena tidak ada yang perlu
 * dijaga di baliknya). Rencana rilis (report-only satu rilis penuh sebelum
 * SECURITY_CSP_ENFORCE=true) TIDAK BISA dijalankan tanpa tempat laporan itu
 * mendarat dan dibaca — itulah satu-satunya tugas route ini.
 *
 * Body laporan dipotong sebelum masuk log supaya endpoint publik tanpa
 * autentikasi ini tidak bisa dijadikan vektor log-spam oleh siapa pun yang
 * tahu URL-nya.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text().catch(() => "");
  const truncated =
    rawBody.length > MAX_LOGGED_BODY_LENGTH
      ? `${rawBody.slice(0, MAX_LOGGED_BODY_LENGTH)}…(dipotong)`
      : rawBody;

  console.warn(
    JSON.stringify({
      level: "warn",
      msg: "csp_violation_report",
      report: truncated,
    }),
  );

  // Browser tidak membaca body respons untuk report-uri; 200 kosong cukup.
  return apiOk(null);
}
