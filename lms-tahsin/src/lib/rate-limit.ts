/**
 * Aturan pembatasan laju (NFR-2).
 *
 * Murni: tidak menyentuh Redis maupun jaringan, supaya aturannya bisa diuji
 * tanpa infrastruktur. Eksekusinya ada di rate-limit-client.ts.
 *
 * Cron dan webhook SENGAJA tidak dibatasi: pemanggilnya bukan pengguna
 * melainkan penjadwal Vercel dan server Midtrans, dan keduanya sudah
 * diotorisasi lewat jalurnya sendiri (CRON_SECRET, signature key).
 */

export type RateLimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
  scope: "ip" | "user";
};

const AUTH_RULE: RateLimitRule = {
  name: "auth",
  limit: 5,
  windowSeconds: 60,
  scope: "ip",
};

const API_RULE: RateLimitRule = {
  name: "api",
  limit: 100,
  windowSeconds: 60,
  scope: "user",
};

const UNLIMITED_PREFIXES = ["/api/cron", "/api/webhooks", "/api/health"];

/**
 * Hanya jalur yang MENERIMA KREDENSIAL yang masuk AUTH_RULE (5/menit/IP).
 *
 * /api/auth/[...nextauth]/route.ts mengekspor seluruh handler Auth.js, jadi
 * /api/auth juga melayani plumbing framework (session, csrf, providers,
 * signout) yang dipanggil SessionProvider di src/components/providers.tsx
 * pada setiap mount DAN setiap window focus. Bucket ini berskop IP, bukan
 * user — jika seluruh /api/auth masuk sini, pengguna yang berbagi satu IP
 * (lab komputer sekolah, kantor, NAT rumah/seluler) akan saling menjatuhkan
 * lewat validasi sesi biasa, bukan karena percobaan brute force.
 *
 * /api/auth/register: route registrasi milik proyek ini sendiri.
 * /api/auth/callback/credentials: jalur sign-in Credentials Auth.js v5.
 * Provider Credentials di @auth/core SELALU memakai id "credentials"
 * (lihat node_modules/@auth/core/providers/credentials.js) walau
 * src/lib/auth.ts memberi `name: "credentials"` — id inilah yang menjadi
 * bagian URL callback, sudah diverifikasi terhadap @auth/core 0.41.3
 * (next-auth 5.0.0-beta.32) yang terpasang di proyek ini.
 */
const AUTH_PATHS = ["/api/auth/register", "/api/auth/callback/credentials"];

export function rateLimitRuleFor(pathname: string): RateLimitRule | null {
  if (!pathname.startsWith("/api/")) return null;
  if (UNLIMITED_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return AUTH_RULE;
  return API_RULE;
}

export function rateLimitKey(
  rule: RateLimitRule,
  input: { ip: string | null; userId: string | null },
): string | null {
  if (rule.scope === "user" && input.userId) {
    return `${rule.name}:user:${input.userId}`;
  }
  if (input.ip) return `${rule.name}:ip:${input.ip}`;
  return null;
}
