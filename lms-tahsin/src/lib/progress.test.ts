import { describe, expect, it } from "vitest";
import { buildProgressSeries, toPolylinePoints } from "@/lib/progress";

const at = (iso: string): Date => new Date(iso);

describe("buildProgressSeries", () => {
  it("mengelompokkan nilai per kriteria dan mengurutkannya dari sesi terlama", () => {
    const series = buildProgressSeries([
      {
        sessionId: "s2",
        scheduledAt: at("2026-09-10T09:00:00.000Z"),
        criterionId: 1,
        criterionName: "Tajwid",
        score: 80,
      },
      {
        sessionId: "s1",
        scheduledAt: at("2026-09-03T09:00:00.000Z"),
        criterionId: 1,
        criterionName: "Tajwid",
        score: 70,
      },
    ]);

    expect(series).toHaveLength(1);
    expect(series[0].criterionName).toBe("Tajwid");
    expect(series[0].points.map((p) => p.score)).toEqual([70, 80]);
  });

  it("memisahkan kriteria yang berbeda, diurutkan sesuai urutan rubrik", () => {
    const series = buildProgressSeries([
      {
        sessionId: "s1",
        scheduledAt: at("2026-09-03T09:00:00.000Z"),
        criterionId: 2,
        criterionName: "Kelancaran",
        score: 60,
      },
      {
        sessionId: "s1",
        scheduledAt: at("2026-09-03T09:00:00.000Z"),
        criterionId: 1,
        criterionName: "Tajwid",
        score: 90,
      },
    ]);

    expect(series.map((s) => s.criterionName)).toEqual([
      "Tajwid",
      "Kelancaran",
    ]);
  });

  it("menghitung nilai terakhir, rata-rata, dan selisih dari sesi sebelumnya", () => {
    const series = buildProgressSeries([
      {
        sessionId: "s1",
        scheduledAt: at("2026-09-03T09:00:00.000Z"),
        criterionId: 1,
        criterionName: "Tajwid",
        score: 70,
      },
      {
        sessionId: "s2",
        scheduledAt: at("2026-09-10T09:00:00.000Z"),
        criterionId: 1,
        criterionName: "Tajwid",
        score: 85,
      },
    ]);

    expect(series[0].latest).toBe(85);
    expect(series[0].average).toBe(77.5);
    expect(series[0].delta).toBe(15);
  });

  it("selisih null ketika baru ada satu penilaian", () => {
    const series = buildProgressSeries([
      {
        sessionId: "s1",
        scheduledAt: at("2026-09-03T09:00:00.000Z"),
        criterionId: 1,
        criterionName: "Tajwid",
        score: 70,
      },
    ]);

    expect(series[0].delta).toBeNull();
  });

  it("murid tanpa penilaian menghasilkan daftar kosong", () => {
    expect(buildProgressSeries([])).toEqual([]);
  });
});

describe("toPolylinePoints", () => {
  it("membentangkan titik dari tepi kiri ke tepi kanan area gambar", () => {
    const points = toPolylinePoints([0, 100], {
      width: 100,
      height: 40,
      maxScore: 100,
    });

    expect(points).toBe("0,40 100,0");
  });

  it("nilai tinggi digambar di atas, karena sumbu y SVG tumbuh ke bawah", () => {
    const points = toPolylinePoints([50], { width: 100, height: 40, maxScore: 100 });

    expect(points).toBe("50,20");
  });

  it("string kosong ketika tidak ada nilai untuk digambar", () => {
    expect(toPolylinePoints([], { width: 100, height: 40, maxScore: 100 })).toBe(
      "",
    );
  });
});
