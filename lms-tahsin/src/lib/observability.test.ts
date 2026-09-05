import { describe, expect, it } from "vitest";
import { isSensitivePath, scrubSentryEvent } from "@/lib/observability";

describe("isSensitivePath", () => {
  it("menandai route auth, feedback, dan pembayaran sebagai sensitif (NFR-4)", () => {
    expect(isSensitivePath("/api/auth/register")).toBe(true);
    expect(isSensitivePath("/api/sessions/abc-123/feedback")).toBe(true);
    expect(isSensitivePath("/api/invoices/abc/payments")).toBe(true);
    expect(isSensitivePath("/api/webhooks/midtrans")).toBe(true);
  });

  it("tidak menandai route biasa", () => {
    expect(isSensitivePath("/api/sessions")).toBe(false);
    expect(isSensitivePath("/api/pricing-tiers")).toBe(false);
  });
});

describe("scrubSentryEvent", () => {
  it("membuang body request pada path sensitif", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://app.test/api/auth/register",
        data: { password: "rahasia123" },
      },
    });

    expect(event.request?.data).toBeUndefined();
  });

  it("membiarkan body request pada path biasa", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://app.test/api/pricing-tiers",
        data: { durationMinutes: 60 },
      },
    });

    expect(event.request?.data).toEqual({ durationMinutes: 60 });
  });

  it("selalu membuang header authorization dan cookie", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://app.test/api/pricing-tiers",
        headers: { authorization: "Bearer x", cookie: "sid=y", accept: "*/*" },
      },
    });

    expect(event.request?.headers).toEqual({ accept: "*/*" });
  });

  it("aman untuk event tanpa request sama sekali", () => {
    expect(scrubSentryEvent({})).toEqual({});
  });

  it("aman untuk url yang tidak bisa di-parse", () => {
    const event = scrubSentryEvent({
      request: { url: "bukan-url", data: { a: 1 } },
    });

    expect(event.request?.data).toBeUndefined();
  });

  it("meredaksi password connection string pada exception value (NFR-4)", () => {
    const event = scrubSentryEvent({
      exception: {
        values: [
          {
            type: "Error",
            value:
              "connect ECONNREFUSED postgres://user:hunter2@db.internal:5432/lms",
          },
        ],
      },
    });

    const value = event.exception?.values?.[0] as
      | { type?: string; value?: string }
      | undefined;
    expect(value?.value).not.toContain("hunter2");
    expect(value?.value).toContain("postgres://***@");
    // Field lain (mis. type) tidak boleh ikut hilang.
    expect(value?.type).toBe("Error");
  });

  it("meredaksi password connection string pada breadcrumb console (NFR-4)", () => {
    const event = scrubSentryEvent({
      breadcrumbs: [
        {
          category: "console",
          message: "gagal konek ke redis://default:hunter2@cache.internal:6379",
        },
      ],
    });

    const crumb = event.breadcrumbs?.[0] as
      | { category?: string; message?: string }
      | undefined;
    expect(crumb?.message).not.toContain("hunter2");
    expect(crumb?.message).toContain("redis://***@");
  });
});
