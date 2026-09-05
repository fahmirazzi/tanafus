import { describe, expect, it } from "vitest";
import {
  regularCandidateDateKeys,
  shouldSkipClassGroup,
} from "@/lib/class-schedule";

const OPEN_GROUP = {
  status: "open",
  activeEnrollmentCount: 5,
  teacherDeleted: false,
};

describe("shouldSkipClassGroup", () => {
  it("null berarti boleh menghasilkan sesi", () => {
    expect(shouldSkipClassGroup(OPEN_GROUP)).toBeNull();
  });

  it("melewati class group yang tidak berstatus open", () => {
    expect(shouldSkipClassGroup({ ...OPEN_GROUP, status: "closed" })).toBe(
      "classGroupClosed",
    );
    expect(shouldSkipClassGroup({ ...OPEN_GROUP, status: "archived" })).toBe(
      "classGroupClosed",
    );
  });

  it("melewati kelas tanpa enrollment aktif — kelas kosong tidak boleh memenuhi kalender guru", () => {
    expect(
      shouldSkipClassGroup({ ...OPEN_GROUP, activeEnrollmentCount: 0 }),
    ).toBe("noEnrollment");
  });

  it("melewati kelas yang gurunya sudah dihapus", () => {
    expect(shouldSkipClassGroup({ ...OPEN_GROUP, teacherDeleted: true })).toBe(
      "deletedUser",
    );
  });

  it("status kelas diperiksa sebelum jumlah enrollment", () => {
    // Kelas yang ditutup DAN kosong dilaporkan sebagai ditutup: itu sebab
    // yang lebih menjelaskan bagi admin yang membaca ringkasan cron.
    expect(
      shouldSkipClassGroup({ ...OPEN_GROUP, status: "closed", activeEnrollmentCount: 0 }),
    ).toBe("classGroupClosed");
  });
});

describe("regularCandidateDateKeys", () => {
  const window = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-14"];

  it("hanya mengambil tanggal yang harinya cocok", () => {
    // 2026-09-07 dan 2026-09-14 adalah Senin.
    const keys = regularCandidateDateKeys({
      windowDateKeys: window,
      dayOfWeek: 1,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
    });

    expect(keys).toEqual(["2026-09-07", "2026-09-14"]);
  });

  it("memotong tanggal sebelum periode dimulai", () => {
    const keys = regularCandidateDateKeys({
      windowDateKeys: window,
      dayOfWeek: 1,
      periodStart: "2026-09-10",
      periodEnd: "2026-12-31",
    });

    expect(keys).toEqual(["2026-09-14"]);
  });

  it("memotong tanggal setelah periode berakhir — ini pengganti effectiveUntil milik privat", () => {
    const keys = regularCandidateDateKeys({
      windowDateKeys: window,
      dayOfWeek: 1,
      periodStart: "2026-01-01",
      periodEnd: "2026-09-08",
    });

    expect(keys).toEqual(["2026-09-07"]);
  });

  it("periode yang belum dimulai menghasilkan nol kandidat", () => {
    const keys = regularCandidateDateKeys({
      windowDateKeys: window,
      dayOfWeek: 1,
      periodStart: "2027-01-01",
      periodEnd: "2027-12-31",
    });

    expect(keys).toEqual([]);
  });
});
