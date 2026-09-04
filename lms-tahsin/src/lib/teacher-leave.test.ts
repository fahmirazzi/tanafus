import { describe, expect, it } from "vitest";
import {
  canRequestReturn,
  canReviewLeave,
  inclusiveDaySpan,
  isValidLongLeaveRange,
  nextLeaveStatus,
} from "@/lib/teacher-leave";
import { LeaveStatus } from "@/generated/prisma/enums";

describe("inclusiveDaySpan", () => {
  it("satu hari yang sama dihitung sebagai 1 hari", () => {
    expect(inclusiveDaySpan("2026-09-01", "2026-09-01")).toBe(1);
  });

  it("menghitung inklusif kedua ujung", () => {
    expect(inclusiveDaySpan("2026-09-01", "2026-09-14")).toBe(14);
  });

  it("melewati pergantian bulan dengan benar", () => {
    expect(inclusiveDaySpan("2026-09-25", "2026-10-05")).toBe(11);
  });
});

describe("isValidLongLeaveRange", () => {
  it("13 hari belum cukup untuk cuti panjang (BR-06.2)", () => {
    expect(isValidLongLeaveRange("2026-09-01", "2026-09-13")).toBe(false);
  });

  it("tepat 14 hari sudah cukup", () => {
    expect(isValidLongLeaveRange("2026-09-01", "2026-09-14")).toBe(true);
  });

  it("rentang berbulan-bulan tetap valid", () => {
    expect(isValidLongLeaveRange("2026-09-01", "2026-12-01")).toBe(true);
  });
});

describe("canReviewLeave / nextLeaveStatus", () => {
  it("hanya pengajuan pending yang bisa disetujui atau ditolak", () => {
    expect(canReviewLeave(LeaveStatus.pending, "approve")).toBe(true);
    expect(canReviewLeave(LeaveStatus.pending, "reject")).toBe(true);
    expect(canReviewLeave(LeaveStatus.approved, "approve")).toBe(false);
    expect(canReviewLeave(LeaveStatus.rejected, "reject")).toBe(false);
  });

  it("memetakan aksi ke status tujuan", () => {
    expect(nextLeaveStatus("approve")).toBe(LeaveStatus.approved);
    expect(nextLeaveStatus("reject")).toBe(LeaveStatus.rejected);
  });
});

describe("canRequestReturn", () => {
  it("hanya cuti yang sudah disetujui yang bisa diminta berakhir", () => {
    expect(canRequestReturn(LeaveStatus.approved)).toBe(true);
  });

  it("pengajuan yang masih pending, sudah ditolak, atau sudah selesai tidak bisa", () => {
    expect(canRequestReturn(LeaveStatus.pending)).toBe(false);
    expect(canRequestReturn(LeaveStatus.rejected)).toBe(false);
    expect(canRequestReturn(LeaveStatus.ended)).toBe(false);
  });
});
