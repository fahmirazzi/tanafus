import { describe, expect, it } from "vitest";
import {
  DELETION_GRACE_DAYS,
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
