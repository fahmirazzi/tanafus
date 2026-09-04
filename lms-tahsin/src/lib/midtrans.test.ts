import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildOrderId,
  expectedSignature,
  parseNotification,
  resolveOutcome,
  verifySignature,
  type MidtransNotification,
} from "@/lib/midtrans";

const SERVER_KEY = "SB-Mid-server-KUNCI-UJI";

function signedNotification(
  overrides: Partial<MidtransNotification> = {},
): MidtransNotification {
  const base = {
    order_id: "INV-202609-000123-a1b2c3d4",
    status_code: "200",
    gross_amount: "180000.00",
    transaction_status: "settlement",
    fraud_status: null,
    payment_type: "qris",
    transaction_id: "trx-1",
    ...overrides,
  };
  return {
    ...base,
    signature_key:
      overrides.signature_key ?? expectedSignature(base, SERVER_KEY),
  };
}

describe("expectedSignature", () => {
  it("adalah SHA-512 dari order_id + status_code + gross_amount + server key", () => {
    const manual = createHash("sha512")
      .update(`INV-1200180000.00${SERVER_KEY}`)
      .digest("hex");

    expect(
      expectedSignature(
        { order_id: "INV-1", status_code: "200", gross_amount: "180000.00" },
        SERVER_KEY,
      ),
    ).toBe(manual);
  });

  it("memperlakukan gross_amount sebagai string apa adanya", () => {
    const withCents = expectedSignature(
      { order_id: "INV-1", status_code: "200", gross_amount: "180000.00" },
      SERVER_KEY,
    );
    const withoutCents = expectedSignature(
      { order_id: "INV-1", status_code: "200", gross_amount: "180000" },
      SERVER_KEY,
    );

    expect(withCents).not.toBe(withoutCents);
  });
});

describe("verifySignature", () => {
  it("menerima notifikasi yang ditandatangani server key yang benar", () => {
    expect(verifySignature(signedNotification(), SERVER_KEY)).toBe(true);
  });

  it("menolak notifikasi yang nilainya diubah setelah ditandatangani", () => {
    const tampered = { ...signedNotification(), gross_amount: "10000.00" };
    expect(verifySignature(tampered, SERVER_KEY)).toBe(false);
  });

  it("menolak tanda tangan dari server key lain", () => {
    expect(verifySignature(signedNotification(), "SB-Mid-server-LAIN")).toBe(
      false,
    );
  });

  it("menolak tanda tangan yang panjangnya tidak wajar tanpa melempar", () => {
    const bogus = signedNotification({ signature_key: "pendek" });
    expect(verifySignature(bogus, SERVER_KEY)).toBe(false);
  });
});

describe("parseNotification", () => {
  it("mengembalikan null untuk payload yang bukan objek", () => {
    expect(parseNotification("bukan objek")).toBeNull();
    expect(parseNotification(null)).toBeNull();
  });

  it("mengembalikan null ketika field wajib hilang", () => {
    expect(
      parseNotification({ order_id: "INV-1", status_code: "200" }),
    ).toBeNull();
  });

  it("mengabaikan field asing agar payload baru Midtrans tetap diterima", () => {
    const parsed = parseNotification({
      order_id: "INV-1",
      status_code: "200",
      gross_amount: "180000.00",
      signature_key: "abc",
      transaction_status: "settlement",
      fitur_baru_midtrans: { apa_pun: true },
    });

    expect(parsed?.order_id).toBe("INV-1");
    expect(parsed?.fraud_status).toBeNull();
  });
});

describe("resolveOutcome", () => {
  it("settlement berarti lunas", () => {
    expect(
      resolveOutcome({ transaction_status: "settlement", fraud_status: null }),
    ).toBe("paid");
  });

  it("capture hanya lunas bila fraud_status accept", () => {
    expect(
      resolveOutcome({ transaction_status: "capture", fraud_status: "accept" }),
    ).toBe("paid");
    expect(
      resolveOutcome({
        transaction_status: "capture",
        fraud_status: "challenge",
      }),
    ).toBe("pending");
  });

  it("deny, cancel, expire, dan failure berarti gagal", () => {
    for (const status of ["deny", "cancel", "expire", "failure"]) {
      expect(
        resolveOutcome({ transaction_status: status, fraud_status: null }),
      ).toBe("failed");
    }
  });

  it("status yang belum dikenal dianggap pending, bukan gagal", () => {
    expect(
      resolveOutcome({ transaction_status: "status_baru", fraud_status: null }),
    ).toBe("pending");
  });
});

describe("buildOrderId", () => {
  it("mengawali dengan nomor invoice agar mudah ditelusuri", () => {
    expect(buildOrderId("INV-202609-000123")).toMatch(
      /^INV-202609-000123-[0-9a-f]{8}$/,
    );
  });

  it("berbeda tiap percobaan bayar", () => {
    expect(buildOrderId("INV-1")).not.toBe(buildOrderId("INV-1"));
  });
});
