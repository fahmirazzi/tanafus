import { describe, expect, it } from "vitest";
import {
  AUTOMATIC_SUSPENSION_MARKER,
  isAutomaticSuspensionReason,
} from "@/lib/suspension-marker";

describe("isAutomaticSuspensionReason", () => {
  it("true untuk alasan yang diawali penanda otomatis", () => {
    expect(
      isAutomaticSuspensionReason(`${AUTOMATIC_SUSPENSION_MARKER}Tagihan INV-1 terlambat 15 hari`),
    ).toBe(true);
  });

  it("false untuk alasan manual admin tanpa penanda", () => {
    expect(isAutomaticSuspensionReason("Dicurigai penipuan, ditangguhkan sementara")).toBe(
      false,
    );
  });

  it("false untuk null (tidak sedang disuspend)", () => {
    expect(isAutomaticSuspensionReason(null)).toBe(false);
  });

  it("false untuk string kosong", () => {
    expect(isAutomaticSuspensionReason("")).toBe(false);
  });
});
