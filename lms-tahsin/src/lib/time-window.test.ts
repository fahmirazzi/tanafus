import { describe, expect, it } from "vitest";
import { addMinutesToTime, timeOverlaps, toMinutes } from "@/lib/time-window";

describe("toMinutes", () => {
  it("mengubah jam menjadi menit sejak tengah malam", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("16:00")).toBe(960);
    expect(toMinutes("16:30")).toBe(990);
    expect(toMinutes("23:59")).toBe(1439);
  });
});

describe("addMinutesToTime", () => {
  it("menambah durasi ke jam mulai", () => {
    expect(addMinutesToTime("16:00", 60)).toBe("17:00");
    expect(addMinutesToTime("16:45", 30)).toBe("17:15");
  });
});

describe("timeOverlaps", () => {
  it("mendeteksi slot yang mulai di tengah slot lain", () => {
    // Inti temuan review akhir: kelas 60 menit yang mulai 16:00 BENAR-BENAR
    // bentrok dengan sesi privat 16:30 — pencocokan startTime persis
    // melewatkan kasus ini sepenuhnya.
    expect(
      timeOverlaps(
        { startTime: "16:00", durationMinutes: 60 },
        { startTime: "16:30", durationMinutes: 60 },
      ),
    ).toBe(true);
  });

  it("simetris — urutan argumen tidak mengubah hasil", () => {
    expect(
      timeOverlaps(
        { startTime: "16:30", durationMinutes: 60 },
        { startTime: "16:00", durationMinutes: 60 },
      ),
    ).toBe(true);
  });

  it("slot yang membungkus slot lebih pendek tetap bentrok", () => {
    expect(
      timeOverlaps(
        { startTime: "16:00", durationMinutes: 120 },
        { startTime: "16:30", durationMinutes: 30 },
      ),
    ).toBe(true);
  });

  it("jam mulai yang sama selalu bentrok", () => {
    expect(
      timeOverlaps(
        { startTime: "16:00", durationMinutes: 60 },
        { startTime: "16:00", durationMinutes: 90 },
      ),
    ).toBe(true);
  });

  it("slot yang bersentuhan ujung TIDAK bentrok", () => {
    expect(
      timeOverlaps(
        { startTime: "16:00", durationMinutes: 60 },
        { startTime: "17:00", durationMinutes: 45 },
      ),
    ).toBe(false);
  });

  it("slot yang benar-benar terpisah tidak bentrok", () => {
    expect(
      timeOverlaps(
        { startTime: "08:00", durationMinutes: 60 },
        { startTime: "16:00", durationMinutes: 60 },
      ),
    ).toBe(false);
  });
});
