import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { RateLimitRule } from "@/lib/rate-limit";

/**
 * Eksekusi pembatasan laju lewat Upstash.
 *
 * Tanpa kredensial Upstash, checkRateLimit SELALU mengizinkan. Akun Upstash
 * yang hilang tidak boleh bisa menjatuhkan login — sama seperti Resend yang
 * hilang tidak menjatuhkan notifikasi.
 */

function redisOrNull(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const limiters = new Map<string, Ratelimit>();

function limiterFor(rule: RateLimitRule): Ratelimit | null {
  const redis = redisOrNull();
  if (!redis) return null;

  const cached = limiters.get(rule.name);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSeconds} s`),
    prefix: `lms:${rule.name}`,
  });
  limiters.set(rule.name, limiter);
  return limiter;
}

/** true = boleh lanjut. Kegagalan Upstash juga mengembalikan true (fail-open). */
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<boolean> {
  const limiter = limiterFor(rule);
  if (!limiter) return true;

  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "rate_limit_unavailable",
        error: String(error),
      }),
    );
    return true;
  }
}
