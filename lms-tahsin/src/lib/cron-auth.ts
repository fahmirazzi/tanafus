import type { NextRequest } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth-guard";

/**
 * Otorisasi endpoint cron.
 *
 * Vercel Cron mengirim header Authorization: Bearer <CRON_SECRET>. Admin yang
 * sedang login juga boleh memicunya manual — berguna untuk menambal jendela
 * setelah cron gagal, tanpa perlu membocorkan secret.
 *
 * Kalau CRON_SECRET belum diset, jalur bearer ditutup rapat. Endpoint cron
 * TIDAK pernah boleh terbuka tanpa otentikasi.
 */
export async function isCronAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    if (header === `Bearer ${secret}`) return true;
  }

  const user = await getSessionUser();
  return user !== null && isAdmin(user);
}
