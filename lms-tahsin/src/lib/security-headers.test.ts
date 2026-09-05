import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "@/lib/security-headers";

function headerValue(
  headers: Array<{ key: string; value: string }>,
  key: string,
): string | undefined {
  return headers.find((h) => h.key === key)?.value;
}

describe("buildSecurityHeaders", () => {
  it("memasang header dasar yang diminta NFR-2", () => {
    const headers = buildSecurityHeaders({ reportOnly: true });

    expect(headerValue(headers, "X-Frame-Options")).toBe("DENY");
    expect(headerValue(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue(headers, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headerValue(headers, "Strict-Transport-Security")).toContain(
      "max-age=",
    );
  });

  it("memakai header CSP report-only saat reportOnly true", () => {
    const headers = buildSecurityHeaders({ reportOnly: true });

    expect(headerValue(headers, "Content-Security-Policy-Report-Only")).toBeDefined();
    expect(headerValue(headers, "Content-Security-Policy")).toBeUndefined();
  });

  it("memakai header CSP penegak saat reportOnly false", () => {
    const headers = buildSecurityHeaders({ reportOnly: false });

    expect(headerValue(headers, "Content-Security-Policy")).toBeDefined();
    expect(
      headerValue(headers, "Content-Security-Policy-Report-Only"),
    ).toBeUndefined();
  });

  it("mengizinkan domain Midtrans Snap di script-src dan frame-src", () => {
    const headers = buildSecurityHeaders({ reportOnly: true });
    const csp = headerValue(headers, "Content-Security-Policy-Report-Only") ?? "";

    expect(csp).toContain("https://app.midtrans.com");
    expect(csp).toContain("https://app.sandbox.midtrans.com");
    expect(csp).toMatch(/frame-src[^;]*midtrans/);
    expect(csp).toMatch(/script-src[^;]*midtrans/);
  });

  it("selalu menutup frame-ancestors", () => {
    const headers = buildSecurityHeaders({ reportOnly: false });
    const csp = headerValue(headers, "Content-Security-Policy") ?? "";

    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("mengizinkan host ingest Sentry lama maupun yang region-scoped", () => {
    const headers = buildSecurityHeaders({ reportOnly: true });
    const csp = headerValue(headers, "Content-Security-Policy-Report-Only") ?? "";

    expect(csp).toMatch(/connect-src[^;]*\*\.ingest\.sentry\.io/);
    expect(csp).toMatch(/connect-src[^;]*\*\.ingest\.us\.sentry\.io/);
    expect(csp).toMatch(/connect-src[^;]*\*\.ingest\.de\.sentry\.io/);
  });

  it("mendaftarkan report-uri supaya pelanggaran CSP bisa dibaca", () => {
    const headers = buildSecurityHeaders({ reportOnly: true });
    const csp = headerValue(headers, "Content-Security-Policy-Report-Only") ?? "";

    expect(csp).toContain("report-uri /api/csp-report");
  });
});
