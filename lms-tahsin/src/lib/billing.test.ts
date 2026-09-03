import { describe, expect, it } from "vitest";
import { computeEarning, resolveSessionAmount } from "@/lib/billing";

describe("resolveSessionAmount", () => {
  it("memakai tarif khusus murid ketika durasinya terdaftar (BR-03.3)", () => {
    const amount = resolveSessionAmount({
      durationMinutes: 60,
      customPrice: { "30": 50000, "60": 75000 },
      tierPrice: 90000,
    });

    expect(amount).toBe(75000);
  });

  it("jatuh ke tarif tier ketika tarif khusus tidak memuat durasi itu", () => {
    const amount = resolveSessionAmount({
      durationMinutes: 45,
      customPrice: { "60": 75000 },
      tierPrice: 70000,
    });

    expect(amount).toBe(70000);
  });

  it("mengabaikan tarif khusus yang bukan angka positif", () => {
    const amount = resolveSessionAmount({
      durationMinutes: 60,
      customPrice: { "60": "gratis" },
      tierPrice: 90000,
    });

    expect(amount).toBe(90000);
  });

  it("null ketika durasi tidak punya tarif khusus maupun tier (BR-03.1)", () => {
    const amount = resolveSessionAmount({
      durationMinutes: 90,
      customPrice: null,
      tierPrice: null,
    });

    expect(amount).toBeNull();
  });
});

describe("computeEarning", () => {
  it("mengalikan charge dengan revenue share guru (BR-05.1)", () => {
    expect(computeEarning(90000, 60)).toBe(54000);
  });

  it("membulatkan ke rupiah penuh, tanpa pecahan sen", () => {
    expect(computeEarning(33333, 60)).toBe(20000);
  });

  it("nol persen berarti tidak ada upah", () => {
    expect(computeEarning(90000, 0)).toBe(0);
  });
});
