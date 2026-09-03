import { describe, expect, it } from "vitest";
import { EarningStatus, PayoutStatus } from "@/generated/prisma/enums";
import {
  canApplyPayoutAction,
  isApprovableEarning,
  isPayoutEligible,
  nextPayoutStatus,
  sumEarnings,
} from "@/lib/payouts";

describe("isApprovableEarning", () => {
  it("hanya upah yang masih menunggu yang bisa disetujui (BR-05.3)", () => {
    expect(isApprovableEarning(EarningStatus.pending)).toBe(true);
    expect(isApprovableEarning(EarningStatus.approved)).toBe(false);
    expect(isApprovableEarning(EarningStatus.paid)).toBe(false);
  });
});

describe("isPayoutEligible", () => {
  it("hanya upah yang sudah disetujui yang boleh masuk pengajuan", () => {
    expect(isPayoutEligible(EarningStatus.approved)).toBe(true);
  });

  it("upah yang belum disetujui tidak boleh ikut dicairkan", () => {
    expect(isPayoutEligible(EarningStatus.pending)).toBe(false);
  });

  it("upah yang sudah dibayar tidak pernah dicairkan dua kali", () => {
    expect(isPayoutEligible(EarningStatus.paid)).toBe(false);
  });
});

describe("canApplyPayoutAction", () => {
  it("pengajuan baru bisa disetujui atau ditolak", () => {
    expect(canApplyPayoutAction(PayoutStatus.requested, "approve")).toBe(true);
    expect(canApplyPayoutAction(PayoutStatus.requested, "reject")).toBe(true);
  });

  it("transfer hanya boleh dicatat setelah ada persetujuan", () => {
    expect(canApplyPayoutAction(PayoutStatus.requested, "mark_paid")).toBe(
      false,
    );
    expect(canApplyPayoutAction(PayoutStatus.approved, "mark_paid")).toBe(true);
  });

  it("pengajuan yang sudah disetujui tidak bisa ditolak belakangan", () => {
    expect(canApplyPayoutAction(PayoutStatus.approved, "reject")).toBe(false);
  });

  it("riwayat tidak ditulis ulang: yang sudah ditransfer atau ditolak final", () => {
    for (const action of ["approve", "reject", "mark_paid"] as const) {
      expect(canApplyPayoutAction(PayoutStatus.paid, action)).toBe(false);
      expect(canApplyPayoutAction(PayoutStatus.rejected, action)).toBe(false);
    }
  });
});

describe("nextPayoutStatus", () => {
  it("memetakan tiap aksi ke status tujuannya", () => {
    expect(nextPayoutStatus("approve")).toBe(PayoutStatus.approved);
    expect(nextPayoutStatus("reject")).toBe(PayoutStatus.rejected);
    expect(nextPayoutStatus("mark_paid")).toBe(PayoutStatus.paid);
  });
});

describe("sumEarnings", () => {
  it("menjumlahkan seluruh upah dalam satu pengajuan", () => {
    expect(sumEarnings([54000, 30000, 42000])).toBe(126000);
  });

  it("pengajuan kosong bernilai nol", () => {
    expect(sumEarnings([])).toBe(0);
  });

  it("membulatkan ke rupiah penuh, tanpa pecahan sen", () => {
    expect(sumEarnings([20000.4, 20000.4])).toBe(40001);
  });
});
