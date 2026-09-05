import { describe, expect, it } from "vitest";
import { redactError, redactSecrets } from "@/lib/redact";

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

describe("redactSecrets", () => {
  it("membuang kredensial tanpa memotong panjang teks", () => {
    const long = `redis://user:hunter2@cache:6379 ${"y".repeat(5000)}`;
    const result = redactSecrets(long);

    expect(result).not.toContain("hunter2");
    expect(result).toContain("redis://***@cache:6379");
    expect(result.length).toBeGreaterThan(2000);
  });

  it("membiarkan teks tanpa kredensial apa adanya", () => {
    expect(redactSecrets("kesalahan biasa tanpa URL")).toBe(
      "kesalahan biasa tanpa URL",
    );
  });
});
