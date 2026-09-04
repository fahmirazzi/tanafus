import { describe, expect, it } from "vitest";
import { rateLimitKey, rateLimitRuleFor } from "@/lib/rate-limit";

describe("rateLimitRuleFor", () => {
  it("membatasi endpoint registrasi 5 per menit per IP (NFR-2)", () => {
    const rule = rateLimitRuleFor("/api/auth/register");

    expect(rule).toEqual({
      name: "auth",
      limit: 5,
      windowSeconds: 60,
      scope: "ip",
    });
  });

  it("membatasi endpoint login credentials Auth.js 5 per menit per IP (NFR-2)", () => {
    // Path callback provider credentials Auth.js v5 (@auth/core 0.41.3):
    // Credentials() SELALU memakai id "credentials" (lihat
    // node_modules/@auth/core/providers/credentials.js), terlepas dari
    // `name` yang diberikan di src/lib/auth.ts. Rute callback-nya
    // /api/auth/callback/:providerId, jadi jalur nyatanya
    // /api/auth/callback/credentials.
    const rule = rateLimitRuleFor("/api/auth/callback/credentials");

    expect(rule).toEqual({
      name: "auth",
      limit: 5,
      windowSeconds: 60,
      scope: "ip",
    });
  });

  it("TIDAK membatasi ketat /api/auth/session — dipanggil SessionProvider tiap fokus jendela, bukan percobaan kredensial", () => {
    const rule = rateLimitRuleFor("/api/auth/session");

    expect(rule).toEqual({
      name: "api",
      limit: 100,
      windowSeconds: 60,
      scope: "user",
    });
  });

  it("TIDAK membatasi ketat /api/auth/csrf — plumbing token CSRF, bukan percobaan kredensial", () => {
    const rule = rateLimitRuleFor("/api/auth/csrf");

    expect(rule).toEqual({
      name: "api",
      limit: 100,
      windowSeconds: 60,
      scope: "user",
    });
  });

  it("membatasi API umum 100 per menit per user (NFR-2)", () => {
    const rule = rateLimitRuleFor("/api/sessions");

    expect(rule).toEqual({
      name: "api",
      limit: 100,
      windowSeconds: 60,
      scope: "user",
    });
  });

  it("TIDAK membatasi endpoint cron — dipicu penjadwal, bukan pengguna", () => {
    expect(rateLimitRuleFor("/api/cron/generate-sessions")).toBeNull();
  });

  it("TIDAK membatasi webhook Midtrans — pengirimnya server pembayaran", () => {
    expect(rateLimitRuleFor("/api/webhooks/midtrans")).toBeNull();
  });

  it("TIDAK membatasi halaman non-API", () => {
    expect(rateLimitRuleFor("/parent/billing")).toBeNull();
  });
});

describe("rateLimitKey", () => {
  const authRule = {
    name: "auth",
    limit: 5,
    windowSeconds: 60,
    scope: "ip" as const,
  };
  const apiRule = {
    name: "api",
    limit: 100,
    windowSeconds: 60,
    scope: "user" as const,
  };

  it("memakai IP untuk aturan berskop ip", () => {
    expect(rateLimitKey(authRule, { ip: "1.2.3.4", userId: null })).toBe(
      "auth:ip:1.2.3.4",
    );
  });

  it("memakai id user untuk aturan berskop user", () => {
    expect(rateLimitKey(apiRule, { ip: "1.2.3.4", userId: "u-1" })).toBe(
      "api:user:u-1",
    );
  });

  it("jatuh ke IP ketika aturan berskop user tapi belum login", () => {
    expect(rateLimitKey(apiRule, { ip: "1.2.3.4", userId: null })).toBe(
      "api:ip:1.2.3.4",
    );
  });

  it("null ketika tidak ada IP maupun user — jangan membatasi yang tak dikenali", () => {
    expect(rateLimitKey(apiRule, { ip: null, userId: null })).toBeNull();
  });
});
