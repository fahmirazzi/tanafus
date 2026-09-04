import { describe, expect, it } from "vitest";
import { SessionStatus } from "@/generated/prisma/enums";
import {
  canApplyAction,
  isBillableStatus,
  nextStatusFor,
} from "@/lib/session-actions";

describe("nextStatusFor", () => {
  it("memetakan tiap aksi guru ke status sesi (PRD F-3a)", () => {
    expect(nextStatusFor("start")).toBe(SessionStatus.in_progress);
    expect(nextStatusFor("complete")).toBe(SessionStatus.completed);
    expect(nextStatusFor("complete_absent")).toBe(
      SessionStatus.completed_absent,
    );
    expect(nextStatusFor("cancel_teacher")).toBe(
      SessionStatus.cancelled_teacher,
    );
  });
});

describe("canApplyAction", () => {
  it("sesi terjadwal bisa dimulai", () => {
    expect(canApplyAction(SessionStatus.scheduled, "start")).toBe(true);
  });

  it("sesi yang sudah berlangsung tidak bisa dimulai ulang", () => {
    expect(canApplyAction(SessionStatus.in_progress, "start")).toBe(false);
  });

  it("sesi bisa diselesaikan langsung dari terjadwal tanpa ditekan mulai", () => {
    expect(canApplyAction(SessionStatus.scheduled, "complete")).toBe(true);
    expect(canApplyAction(SessionStatus.in_progress, "complete")).toBe(true);
  });

  it("sesi yang sudah selesai tidak bisa diubah lagi (BR-04.1)", () => {
    expect(canApplyAction(SessionStatus.completed, "complete")).toBe(false);
    expect(canApplyAction(SessionStatus.completed, "cancel_teacher")).toBe(
      false,
    );
    expect(canApplyAction(SessionStatus.completed_absent, "complete")).toBe(
      false,
    );
  });

  it("sesi yang sudah dibatalkan tidak bisa dihidupkan kembali", () => {
    expect(canApplyAction(SessionStatus.cancelled_student, "complete")).toBe(
      false,
    );
    expect(
      canApplyAction(SessionStatus.cancelled_teacher, "cancel_teacher"),
    ).toBe(false);
  });

  it("guru boleh meliburkan sesi yang sedang berlangsung maupun terjadwal (BR-01.3)", () => {
    expect(canApplyAction(SessionStatus.scheduled, "cancel_teacher")).toBe(
      true,
    );
    expect(canApplyAction(SessionStatus.in_progress, "cancel_teacher")).toBe(
      true,
    );
  });
});

describe("isBillableStatus", () => {
  it("hanya completed dan completed_absent yang menagih (BR-04.1)", () => {
    expect(isBillableStatus(SessionStatus.completed)).toBe(true);
    expect(isBillableStatus(SessionStatus.completed_absent)).toBe(true);
  });

  it("sesi diliburkan tidak pernah menagih (BR-01.3, BR-04.2)", () => {
    expect(isBillableStatus(SessionStatus.cancelled_teacher)).toBe(false);
    expect(isBillableStatus(SessionStatus.cancelled_student)).toBe(false);
    expect(isBillableStatus(SessionStatus.in_progress)).toBe(false);
    expect(isBillableStatus(SessionStatus.scheduled)).toBe(false);
  });
});
