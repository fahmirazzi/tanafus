import { describe, expect, it } from "vitest";
import { isRosterComplete, missingFromRoster } from "@/lib/attendance";

const roster = ["m1", "m2", "m3"];

describe("missingFromRoster", () => {
  it("kosong ketika semua murid sudah ditandai", () => {
    expect(
      missingFromRoster(roster, [
        { studentId: "m1", status: "present" },
        { studentId: "m2", status: "absent" },
        { studentId: "m3", status: "excused" },
      ]),
    ).toEqual([]);
  });

  it("menyebut murid yang belum ditandai", () => {
    expect(
      missingFromRoster(roster, [{ studentId: "m1", status: "present" }]),
    ).toEqual(["m2", "m3"]);
  });

  it("mengabaikan tanda untuk murid di luar roster", () => {
    // Murid yang sudah dikeluarkan dari kelas bisa saja masih terkirim dari
    // layar yang basi; itu tidak boleh dianggap melengkapi roster.
    expect(
      missingFromRoster(roster, [
        { studentId: "m1", status: "present" },
        { studentId: "m2", status: "present" },
        { studentId: "m3", status: "present" },
        { studentId: "orang-lain", status: "present" },
      ]),
    ).toEqual([]);
  });

  it("roster kosong tidak pernah kekurangan apa pun", () => {
    expect(missingFromRoster([], [])).toEqual([]);
  });
});

describe("isRosterComplete", () => {
  it("true hanya ketika tidak ada yang tertinggal", () => {
    expect(
      isRosterComplete(roster, [
        { studentId: "m1", status: "present" },
        { studentId: "m2", status: "late" },
        { studentId: "m3", status: "absent" },
      ]),
    ).toBe(true);
  });

  it("false ketika ada satu saja yang belum ditandai", () => {
    // BR-02.6a menjadikan kehadiran gerbang kenaikan level; satu no_info yang
    // diam merusak gerbang itu secara permanen tanpa ada yang sadar.
    expect(
      isRosterComplete(roster, [
        { studentId: "m1", status: "present" },
        { studentId: "m2", status: "present" },
      ]),
    ).toBe(false);
  });
});
