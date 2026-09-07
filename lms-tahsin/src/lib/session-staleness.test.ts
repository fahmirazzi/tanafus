import { describe, expect, it } from "vitest";
import { isSessionStale } from "@/lib/session-staleness";

describe("isSessionStale", () => {
  it("sesi yang jam selesainya sudah lewat dianggap basi", () => {
    const scheduledAt = new Date("2026-09-07T08:00:00.000Z");
    const now = new Date("2026-09-07T09:01:00.000Z"); // 61 menit kemudian
    expect(isSessionStale({ scheduledAt, durationMinutes: 60 }, now)).toBe(true);
  });

  it("sesi yang sedang berlangsung belum basi", () => {
    const scheduledAt = new Date("2026-09-07T08:00:00.000Z");
    const now = new Date("2026-09-07T08:30:00.000Z");
    expect(isSessionStale({ scheduledAt, durationMinutes: 60 }, now)).toBe(false);
  });

  it("tepat di detik jam selesai belum dianggap basi", () => {
    const scheduledAt = new Date("2026-09-07T08:00:00.000Z");
    const now = new Date("2026-09-07T09:00:00.000Z");
    expect(isSessionStale({ scheduledAt, durationMinutes: 60 }, now)).toBe(false);
  });

  it("sesi yang belum mulai tidak pernah basi", () => {
    const scheduledAt = new Date("2026-09-08T08:00:00.000Z");
    const now = new Date("2026-09-07T08:00:00.000Z");
    expect(isSessionStale({ scheduledAt, durationMinutes: 60 }, now)).toBe(false);
  });
});
