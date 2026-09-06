import { describe, expect, it } from "vitest";
import {
  startOfLocalDay,
  zonedDateKey,
  zonedDateTimeToUtc,
  zonedDayOfWeek,
} from "@/lib/zoned-date";

describe("startOfLocalDay", () => {
  it("menghasilkan tengah malam WIB, bukan pukul 07:00", () => {
    // Inti temuan review: `new Date(`${zonedDateKey(x)}T00:00:00.000Z`)` tampak
    // setara tapi menempelkan Z pada tanggal LOKAL, sehingga jatuh 7 jam
    // terlambat. Uji ini mengunci selisih itu.
    const now = new Date("2026-09-07T10:00:00.000Z");
    expect(startOfLocalDay(now).toISOString()).toBe("2026-09-06T17:00:00.000Z");

    const naif = new Date(`${zonedDateKey(now)}T00:00:00.000Z`);
    expect(naif.toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(startOfLocalDay(now).getTime()).toBeLessThan(naif.getTime());
  });

  it("sesi subuh hari ini berada SESUDAH awal hari", () => {
    // 05:30 WIB pada 2026-09-07. Dengan bentuk naif, sesi ini tersaring keluar
    // dari pemindahan guru — regresi yang benar-benar terjadi.
    const now = new Date("2026-09-07T10:00:00.000Z");
    const subuh = zonedDateTimeToUtc("2026-09-07", "05:30");
    expect(subuh.getTime()).toBeGreaterThanOrEqual(
      startOfLocalDay(now).getTime(),
    );
  });

  it("sesi kemarin tetap berada SEBELUM awal hari", () => {
    const now = new Date("2026-09-07T10:00:00.000Z");
    const kemarin = zonedDateTimeToUtc("2026-09-06", "23:00");
    expect(kemarin.getTime()).toBeLessThan(startOfLocalDay(now).getTime());
  });

  it("tetap benar saat dipanggil lewat tengah malam WIB", () => {
    // 00:30 WIB 8 Sep = 17:30Z 7 Sep. Awal harinya harus 8 Sep, bukan 7 Sep.
    const larutMalam = new Date("2026-09-07T17:30:00.000Z");
    expect(startOfLocalDay(larutMalam).toISOString()).toBe(
      "2026-09-07T17:00:00.000Z",
    );
  });
});

describe("zonedDayOfWeek", () => {
  it("membaca hari dalam zona lembaga", () => {
    expect(zonedDayOfWeek("2026-09-07")).toBe(1); // Senin
    expect(zonedDayOfWeek("2026-09-06")).toBe(0); // Minggu
  });
});
