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

export function rateLimitRuleFor(pathname: string): RateLimitRule | null {
  if (!pathname.startsWith("/api/")) return null;
  if (UNLIMITED_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (pathname.startsWith("/api/auth")) return AUTH_RULE;
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
