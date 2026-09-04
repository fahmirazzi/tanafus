import { describe, expect, it } from "vitest";
import { rateLimitKey, rateLimitRuleFor } from "@/lib/rate-limit";

describe("rateLimitRuleFor", () => {
  it("membatasi endpoint auth 5 per menit per IP (NFR-2)", () => {
    const rule = rateLimitRuleFor("/api/auth/register");

    expect(rule).toEqual({
      name: "auth",
      limit: 5,
      windowSeconds: 60,
      scope: "ip",
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
