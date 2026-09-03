import { describe, expect, it } from "vitest";
import { InvoiceStatus } from "@/generated/prisma/enums";
import {
  dueDateKeyFor,
  daysPastDue,
  formatInvoiceNumber,
  isPastDue,
  sessionItemDescription,
  shouldSuspend,
  statusAfterPayments,
} from "@/lib/invoices";

describe("formatInvoiceNumber", () => {
  it("menyusun nomor dari bulan terbit dan urutan sequence", () => {
    expect(formatInvoiceNumber("2026-09-03", 123)).toBe("INV-202609-000123");
  });

  it("menerima bigint karena nextval Postgres bertipe bigint", () => {
    expect(formatInvoiceNumber("2026-01-31", BigInt(7))).toBe("INV-202601-000007");
  });

  it("tidak memotong nomor yang melewati enam digit", () => {
    expect(formatInvoiceNumber("2026-09-03", 1234567)).toBe("INV-202609-1234567");
  });
});

describe("dueDateKeyFor", () => {
  it("jatuh tempo tujuh hari setelah terbit (BR-04.5)", () => {
    expect(dueDateKeyFor("2026-09-03")).toBe("2026-09-10");
  });

  it("melewati pergantian bulan dengan benar", () => {
    expect(dueDateKeyFor("2026-09-28")).toBe("2026-10-05");
  });

  it("melewati 29 Februari tahun kabisat", () => {
    expect(dueDateKeyFor("2028-02-25")).toBe("2028-03-03");
  });
});

describe("daysPastDue", () => {
  it("negatif ketika jatuh tempo masih di depan", () => {
    expect(daysPastDue("2026-09-10", "2026-09-03")).toBe(-7);
  });

  it("nol tepat pada hari jatuh tempo", () => {
    expect(daysPastDue("2026-09-10", "2026-09-10")).toBe(0);
  });

  it("menghitung lintas bulan", () => {
    expect(daysPastDue("2026-09-28", "2026-10-05")).toBe(7);
  });
});

describe("isPastDue", () => {
  it("belum terlambat pada hari jatuh tempo — murid punya waktu sampai tengah malam", () => {
    expect(isPastDue("2026-09-10", "2026-09-10")).toBe(false);
  });

  it("terlambat sehari setelahnya", () => {
    expect(isPastDue("2026-09-10", "2026-09-11")).toBe(true);
  });
});

describe("shouldSuspend", () => {
  it("belum disuspend pada hari ke-14 — BR-04.6 menuntut LEBIH dari 14 hari", () => {
    expect(shouldSuspend("2026-09-10", "2026-09-24")).toBe(false);
  });

  it("disuspend pada hari ke-15 (skenario acceptance PRD)", () => {
    expect(shouldSuspend("2026-09-10", "2026-09-25")).toBe(true);
  });

  it("invoice yang belum jatuh tempo tidak pernah memicu suspensi", () => {
    expect(shouldSuspend("2026-09-10", "2026-09-01")).toBe(false);
  });
});

describe("sessionItemDescription", () => {
  it("menyebut tanggal WIB dan durasi sesi", () => {
    // 12 Februari 2025 pukul 16.00 WIB = 09:00 UTC.
    const scheduledAt = new Date("2025-02-12T09:00:00.000Z");
    expect(sessionItemDescription(scheduledAt, 60)).toBe(
      "Sesi Privat 12 Februari 2025, 60 menit",
    );
  });

  it("memakai tanggal WIB, bukan UTC, untuk sesi malam", () => {
    // 12 Februari 2025 pukul 20.00 WIB masih 13:00 UTC di hari yang sama,
    // tetapi 00.30 WIB tanggal 13 sudah 17:30 UTC tanggal 12.
    const scheduledAt = new Date("2025-02-12T17:30:00.000Z");
    expect(sessionItemDescription(scheduledAt, 30)).toBe(
      "Sesi Privat 13 Februari 2025, 30 menit",
    );
  });
});

describe("statusAfterPayments", () => {
  const issued = InvoiceStatus.issued;

  it("lunas ketika pembayaran sah menutup seluruh total", () => {
    expect(
      statusAfterPayments({ total: 180000, verifiedTotal: 180000, current: issued }),
    ).toBe(InvoiceStatus.paid);
  });

  it("lunas juga ketika murid membayar lebih", () => {
    expect(
      statusAfterPayments({ total: 180000, verifiedTotal: 200000, current: issued }),
    ).toBe(InvoiceStatus.paid);
  });

  it("dibayar sebagian ketika baru sebagian yang masuk", () => {
    expect(
      statusAfterPayments({ total: 180000, verifiedTotal: 90000, current: issued }),
    ).toBe(InvoiceStatus.partial);
  });

  it("kembali menagih ketika pembayaran sebelumnya dibatalkan", () => {
    expect(
      statusAfterPayments({
        total: 180000,
        verifiedTotal: 0,
        current: InvoiceStatus.paid,
      }),
    ).toBe(issued);
  });

  it("mempertahankan status terlambat ketika belum ada pembayaran sah", () => {
    expect(
      statusAfterPayments({
        total: 180000,
        verifiedTotal: 0,
        current: InvoiceStatus.overdue,
      }),
    ).toBe(InvoiceStatus.overdue);
  });

  it("invoice yang sudah di-void tidak pernah berubah oleh pembayaran (BR-04.7)", () => {
    expect(
      statusAfterPayments({
        total: 180000,
        verifiedTotal: 180000,
        current: InvoiceStatus.void,
      }),
    ).toBe(InvoiceStatus.void);
  });
});
