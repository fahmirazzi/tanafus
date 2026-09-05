import { describe, expect, it } from "vitest";
import {
  DELETION_GRACE_DAYS,
  buildAnonymizedUserData,
  checkDeletionEligibility,
  deletionExecuteAfter,
  isDeletionDue,
} from "@/lib/account-deletion";

describe("checkDeletionEligibility", () => {
  it("mengizinkan ketika tidak ada tanggungan apa pun", () => {
    expect(
      checkDeletionEligibility({
        unpaidInvoiceCount: 0,
        unsettledEarningCount: 0,
      }),
    ).toEqual({ allowed: true, reason: null });
  });

  it("menolak ketika masih ada tagihan belum lunas", () => {
    const result = checkDeletionEligibility({
      unpaidInvoiceCount: 2,
      unsettledEarningCount: 0,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("tagihan");
  });

  it("menolak ketika guru masih punya upah belum tersalur", () => {
    const result = checkDeletionEligibility({
      unpaidInvoiceCount: 0,
      unsettledEarningCount: 3,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("upah");
  });

  it("menyebut tagihan lebih dulu ketika keduanya ada", () => {
    const result = checkDeletionEligibility({
      unpaidInvoiceCount: 1,
      unsettledEarningCount: 1,
    });

    expect(result.reason).toContain("tagihan");
  });
});

describe("deletionExecuteAfter", () => {
  it("memberi tenggang tepat 7 hari", () => {
    expect(DELETION_GRACE_DAYS).toBe(7);

    const requestedAt = new Date("2026-09-04T10:00:00.000Z");
    expect(deletionExecuteAfter(requestedAt).toISOString()).toBe(
      "2026-09-11T10:00:00.000Z",
    );
  });
});

describe("isDeletionDue", () => {
  const executeAfter = new Date("2026-09-11T10:00:00.000Z");

  it("belum jatuh tempo sebelum tenggang lewat", () => {
    expect(isDeletionDue(executeAfter, new Date("2026-09-10T10:00:00.000Z"))).toBe(
      false,
    );
  });

  it("jatuh tempo tepat pada detik tenggang berakhir", () => {
    expect(isDeletionDue(executeAfter, executeAfter)).toBe(true);
  });

  it("jatuh tempo setelah tenggang lewat", () => {
    expect(isDeletionDue(executeAfter, new Date("2026-09-12T10:00:00.000Z"))).toBe(
      true,
    );
  });
});

describe("buildAnonymizedUserData", () => {
  const now = new Date("2026-09-11T10:00:00.000Z");

  it("mengosongkan seluruh kolom identitas", () => {
    const data = buildAnonymizedUserData(now);

    expect(data.fullName).toBe("Pengguna dihapus");
    expect(data.photoUrl).toBeNull();
    expect(data.address).toBeNull();
    expect(data.birthDate).toBeNull();
    expect(data.gender).toBeNull();
    expect(data.suspensionReason).toBeNull();
  });

  it("mengosongkan email dan telepon menjadi NULL, BUKAN string placeholder", () => {
    const data = buildAnonymizedUserData(now);

    // email dan phone bertanda @unique di schema.prisma -- string
    // placeholder (mis. "deleted@..." atau "") akan bentrok begitu ada
    // permintaan penghapusan KEDUA yang dieksekusi.
    expect(data.email).toBeNull();
    expect(data.phone).toBeNull();
  });

  it("mengacak passwordHash menjadi sesuatu yang tidak pernah cocok dengan hash bcrypt asli", () => {
    const data = buildAnonymizedUserData(now);

    expect(data.passwordHash).toMatch(/^deleted:/);
    expect(data.passwordHash).not.toMatch(/^\$2[aby]\$/); // bukan hash bcrypt
  });

  it("menghasilkan passwordHash berbeda pada setiap pemanggilan", () => {
    const first = buildAnonymizedUserData(now);
    const second = buildAnonymizedUserData(now);

    expect(first.passwordHash).not.toBe(second.passwordHash);
  });

  it("menonaktifkan akun dan mencatat waktu penghapusan", () => {
    const data = buildAnonymizedUserData(now);

    expect(data.isActive).toBe(false);
    expect(data.deletedAt).toBe(now);
  });
});
