import { describe, expect, it } from "vitest";
import {
  DELETION_STATUS,
  canCancelDeletionRequest,
  familyEligibility,
  isPendingReview,
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

describe("DELETION_STATUS", () => {
  it("memuat status baru untuk permintaan yang menunggu admin", () => {
    expect(DELETION_STATUS.awaitingAdmin).toBe("awaiting_admin");
  });

  it("memakai kembali `blocked` untuk penolakan admin, bukan status baru", () => {
    // blockedBy/blockedReason sudah ada di schema sejak Task 8; menolak
    // permintaan adalah persis kasus yang dua kolom itu modelkan.
    expect(DELETION_STATUS.blocked).toBe("blocked");
  });
});

describe("isPendingReview", () => {
  it("true hanya untuk permintaan yang menunggu admin", () => {
    expect(isPendingReview("awaiting_admin")).toBe(true);
  });

  it("false untuk status lain, termasuk yang sudah disetujui", () => {
    for (const status of ["pending", "cancelled", "executed", "blocked"]) {
      expect(isPendingReview(status)).toBe(false);
    }
  });
});

describe("canCancelDeletionRequest", () => {
  it("boleh dibatalkan selama masih menunggu admin", () => {
    expect(canCancelDeletionRequest("awaiting_admin")).toBe(true);
  });

  it("boleh dibatalkan selama masih dalam masa tenggang", () => {
    expect(canCancelDeletionRequest("pending")).toBe(true);
  });

  it("TIDAK boleh dibatalkan setelah dieksekusi -- anonimisasi tidak bisa dibalik", () => {
    expect(canCancelDeletionRequest("executed")).toBe(false);
  });

  it("TIDAK boleh dibatalkan bila sudah ditolak atau dibatalkan", () => {
    expect(canCancelDeletionRequest("blocked")).toBe(false);
    expect(canCancelDeletionRequest("cancelled")).toBe(false);
  });
});

describe("familyEligibility", () => {
  const ok = { allowed: true, reason: null };

  it("mengizinkan bila setiap anggota keluarga lolos", () => {
    expect(familyEligibility([ok, ok])).toEqual(ok);
  });

  it("menolak seluruh permintaan bila SATU anggota masih punya tanggungan", () => {
    const blocked = { allowed: false, reason: "Masih ada tagihan" };

    expect(familyEligibility([ok, blocked, ok])).toEqual(blocked);
  });

  it("mengembalikan alasan anggota pertama yang bermasalah, bukan menggabungkannya", () => {
    const first = { allowed: false, reason: "alasan pertama" };
    const second = { allowed: false, reason: "alasan kedua" };

    expect(familyEligibility([first, second]).reason).toBe("alasan pertama");
  });

  it("daftar kosong dianggap lolos -- tidak ada yang menghalangi", () => {
    expect(familyEligibility([])).toEqual(ok);
  });
});
