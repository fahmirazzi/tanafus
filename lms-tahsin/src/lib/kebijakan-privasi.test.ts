import { describe, expect, it } from "vitest";
import { ISIAN_PEMILIK, kebijakanMasihDraf } from "@/lib/kebijakan-privasi";

describe("kebijakanMasihDraf", () => {
  it("draf selama ada satu isian pemilik yang kosong", () => {
    expect(
      kebijakanMasihDraf({
        a: { perlu: "a", nilai: "terisi" },
        b: { perlu: "b", nilai: null },
      }),
    ).toBe(true);
  });

  it("tidak draf bila semua isian terisi", () => {
    expect(
      kebijakanMasihDraf({
        a: { perlu: "a", nilai: "terisi" },
        b: { perlu: "b", nilai: "terisi juga" },
      }),
    ).toBe(false);
  });

  it("setiap isian menjelaskan apa yang harus diisi", () => {
    for (const isian of Object.values(ISIAN_PEMILIK)) {
      expect(isian.perlu.trim()).not.toBe("");
    }
  });
});
