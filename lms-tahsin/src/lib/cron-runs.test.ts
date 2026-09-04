import { describe, expect, it } from "vitest";
import { CRON_MAX_AGE_HOURS, isCronStale, redactError } from "@/lib/cron-runs";

const NOW = new Date("2026-09-04T10:00:00.000Z");

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3_600_000);
}

describe("isCronStale", () => {
  it("basi ketika belum pernah sukses sama sekali", () => {
    expect(isCronStale(null, "generate_sessions", NOW)).toBe(true);
  });

  it("segar ketika sukses terakhir masih dalam ambang", () => {
    expect(isCronStale(hoursAgo(2), "generate_sessions", NOW)).toBe(false);
  });

  it("basi ketika sukses terakhir melewati ambang", () => {
    const beyond = CRON_MAX_AGE_HOURS.generate_sessions + 1;
    expect(isCronStale(hoursAgo(beyond), "generate_sessions", NOW)).toBe(true);
  });

  it("memberi bundel bulanan ambang yang jauh lebih longgar daripada pengingat", () => {
    expect(CRON_MAX_AGE_HOURS.monthly_invoices).toBeGreaterThan(
      CRON_MAX_AGE_HOURS.send_reminders,
    );
  });

  it("pengingat yang jalan tiap 5 menit dianggap basi setelah beberapa jam", () => {
    expect(isCronStale(hoursAgo(6), "send_reminders", NOW)).toBe(true);
  });
});

describe("redactError", () => {
  it("meredaksi kredensial pada connection string postgres://", () => {
    const err = new Error(
      "connect ECONNREFUSED at postgres://dbuser:hunter2@db.internal:5432/tahsin",
    );
    const result = redactError(err);
    expect(result).not.toContain("hunter2");
    expect(result).toContain("postgres://***@db.internal:5432/tahsin");
  });

  it("meredaksi kredensial pada connection string postgresql://", () => {
    const err = new Error(
      "P1001: Can't reach database server at postgresql://admin:hunter2@localhost:5432/db",
    );
    const result = redactError(err);
    expect(result).not.toContain("hunter2");
    expect(result).toContain("postgresql://***@localhost:5432/db");
  });

  it("tidak pernah membocorkan password apa pun bentuk skema URL-nya", () => {
    const err = new Error(
      "failed for mysql://root:hunter2@127.0.0.1:3306/x and redis://u:hunter2@cache:6379",
    );
    const result = redactError(err);
    expect(result).not.toContain("hunter2");
  });

  it("mempertahankan nama dan pesan Error biasa", () => {
    const err = new TypeError("nilai tidak valid");
    const result = redactError(err);
    expect(result).toContain("TypeError");
    expect(result).toContain("nilai tidak valid");
  });

  it("tidak crash untuk nilai bukan Error (string, objek, null, undefined)", () => {
    expect(() => redactError("gagal total")).not.toThrow();
    expect(() => redactError({ code: "ETIMEDOUT" })).not.toThrow();
    expect(() => redactError(null)).not.toThrow();
    expect(() => redactError(undefined)).not.toThrow();

    expect(redactError("gagal total")).toContain("gagal total");
    expect(typeof redactError(null)).toBe("string");
    expect(typeof redactError(undefined)).toBe("string");
  });

  it("memotong input yang sangat panjang dan menambahkan penanda pemotongan", () => {
    const huge = new Error("x".repeat(5000));
    const result = redactError(huge);
    expect(result.length).toBeLessThanOrEqual(2000);
    expect(result).toMatch(/dipotong/);
  });
});
