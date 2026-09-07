import { describe, expect, it } from "vitest";
import { SessionStatus, SessionType } from "@/generated/prisma/enums";
import {
  REGULAR_ACTIONS,
  canApplyRegularAction,
  createsCharge,
  createsEarning,
  regularNextStatus,
} from "@/lib/regular-sessions";

describe("REGULAR_ACTIONS", () => {
  it("TIDAK menyediakan cancel_teacher (BR-02.4a)", () => {
    // Guru yang membatalkan kelas reguler = lembaga yang membatalkan, dan
    // karenanya wajib make-up. Menyediakan tombol kedua berarti kewajiban itu
    // bisa dihindari cukup dengan memilih tombol yang lain.
    expect(REGULAR_ACTIONS).not.toContain("cancel_teacher");
    expect(REGULAR_ACTIONS).toContain("cancel_institution");
  });

  it("TIDAK menyediakan complete_absent", () => {
    // Bagi kohort, murid tidak datang bukan sifat sesi — kelasnya tetap
    // berlangsung. Ketidakhadiran tinggal di SessionAttendance.
    expect(REGULAR_ACTIONS).not.toContain("complete_absent");
  });
});

describe("regularNextStatus", () => {
  it("memetakan tiap aksi ke statusnya", () => {
    expect(regularNextStatus("start")).toBe(SessionStatus.in_progress);
    expect(regularNextStatus("complete")).toBe(SessionStatus.completed);
    expect(regularNextStatus("cancel_institution")).toBe(
      SessionStatus.cancelled_institution,
    );
  });
});

describe("canApplyRegularAction", () => {
  it("menyelesaikan sesi tidak mensyaratkan tombol Mulai ditekan lebih dulu", () => {
    expect(canApplyRegularAction(SessionStatus.scheduled, "complete")).toBe(true);
    expect(canApplyRegularAction(SessionStatus.in_progress, "complete")).toBe(true);
  });

  it("sesi yang sudah selesai adalah riwayat dan tidak ditulis ulang", () => {
    expect(canApplyRegularAction(SessionStatus.completed, "complete")).toBe(false);
    expect(canApplyRegularAction(SessionStatus.completed, "cancel_institution")).toBe(false);
  });

  it("sesi yang sudah dibatalkan tidak bisa dibatalkan lagi", () => {
    expect(
      canApplyRegularAction(SessionStatus.cancelled_institution, "cancel_institution"),
    ).toBe(false);
  });
});

describe("createsCharge", () => {
  it("privat yang selesai menagih murid", () => {
    expect(createsCharge(SessionType.private, SessionStatus.completed)).toBe(true);
    expect(createsCharge(SessionType.private, SessionStatus.completed_absent)).toBe(true);
  });

  it("REGULER TIDAK PERNAH menagih — biaya periode sudah menutupinya", () => {
    expect(createsCharge(SessionType.regular, SessionStatus.completed)).toBe(false);
  });

  it("status selain selesai tidak menagih apa pun", () => {
    expect(createsCharge(SessionType.private, SessionStatus.cancelled_teacher)).toBe(false);
    expect(createsCharge(SessionType.private, SessionStatus.scheduled)).toBe(false);
  });
});

describe("createsEarning", () => {
  it("keduanya membayar guru saat sesi selesai", () => {
    expect(createsEarning(SessionType.private, SessionStatus.completed)).toBe(true);
    expect(createsEarning(SessionType.regular, SessionStatus.completed)).toBe(true);
  });

  it("privat tetap membayar guru walau murid bolos", () => {
    expect(createsEarning(SessionType.private, SessionStatus.completed_absent)).toBe(true);
  });

  it("sesi batal tidak membayar siapa pun (BR-05.2)", () => {
    expect(createsEarning(SessionType.regular, SessionStatus.cancelled_institution)).toBe(false);
    expect(createsEarning(SessionType.private, SessionStatus.cancelled_teacher)).toBe(false);
  });
});
