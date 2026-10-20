import type { NextResponse } from "next/server";
import { NextResponse as Res } from "next/server";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { loadUserExport } from "@/lib/data-export-loader";

export const dynamic = "force-dynamic";

/**
 * NFR-6: setiap orang boleh mengunduh datanya sendiri. TIDAK ada parameter
 * id — endpoint ini selalu dan hanya mengekspor data pemanggilnya, sehingga
 * tidak ada permukaan IDOR sama sekali. Ekspor data anak oleh orang tua ada
 * di /api/account/family-export; jangan tambahkan id ke sini.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const bundle = await loadUserExport(user.id);

    // Bukan apiOk: ini berkas unduhan, bukan payload API biasa.
    return Res.json(bundle, {
      headers: {
        "Content-Disposition": `attachment; filename="data-tanafus-${user.id}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
