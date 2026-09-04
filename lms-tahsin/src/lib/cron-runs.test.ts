import { describe, expect, it } from "vitest";
import { CRON_MAX_AGE_HOURS, isCronStale } from "@/lib/cron-runs";

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
