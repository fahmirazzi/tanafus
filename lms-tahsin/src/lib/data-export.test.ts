import { describe, expect, it } from "vitest";
import { buildUserExport } from "@/lib/data-export";

const INPUT = {
  user: {
    id: "u-1",
    fullName: "Fatimah Hasan",
    email: "fatimah@test",
    phone: null,
    birthDate: new Date("2015-04-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  sessions: [
    {
      id: "s-1",
      scheduledAt: new Date("2026-02-01T09:00:00.000Z"),
      durationMinutes: 60,
      status: "completed",
    },
  ],
  grades: [{ sessionId: "s-1", criterionName: "Tajwid", score: 85 }],
  feedbacks: [
    {
      sessionId: "s-1",
      strengths: "Makhraj membaik",
      improvements: null,
      nextTarget: null,
    },
  ],
  invoices: [
    {
      id: "i-1",
      invoiceNumber: "INV-001",
      total: 90000,
      status: "paid",
      issueDate: new Date("2026-02-01T00:00:00.000Z"),
    },
  ],
  payments: [
    {
      invoiceId: "i-1",
      amount: 90000,
      method: "manual_transfer",
      status: "verified",
    },
  ],
};

describe("buildUserExport", () => {
  it("memuat versi dan waktu ekspor supaya berkasnya bisa dilacak", () => {
    const bundle = buildUserExport(INPUT);

    expect(bundle.version).toBe(1);
    expect(typeof bundle.exportedAt).toBe("string");
  });

  it("menyalin profil apa adanya", () => {
    const bundle = buildUserExport(INPUT);

    expect(bundle.profile.fullName).toBe("Fatimah Hasan");
    expect(bundle.profile.email).toBe("fatimah@test");
  });

  it("menulis semua tanggal sebagai string ISO agar JSON-nya stabil", () => {
    const bundle = buildUserExport(INPUT);

    expect(bundle.profile.birthDate).toBe("2015-04-01T00:00:00.000Z");
    expect(bundle.sessions[0]?.scheduledAt).toBe("2026-02-01T09:00:00.000Z");
  });

  it("memuat kelima koleksi data", () => {
    const bundle = buildUserExport(INPUT);

    expect(bundle.sessions).toHaveLength(1);
    expect(bundle.grades).toHaveLength(1);
    expect(bundle.feedbacks).toHaveLength(1);
    expect(bundle.invoices).toHaveLength(1);
    expect(bundle.payments).toHaveLength(1);
  });

  it("tidak pernah menyertakan hash password", () => {
    const bundle = buildUserExport(INPUT);

    expect(JSON.stringify(bundle)).not.toContain("passwordHash");
  });

  it("menangani koleksi kosong tanpa error", () => {
    const bundle = buildUserExport({
      ...INPUT,
      sessions: [],
      grades: [],
      feedbacks: [],
      invoices: [],
      payments: [],
    });

    expect(bundle.sessions).toEqual([]);
    expect(bundle.profile.fullName).toBe("Fatimah Hasan");
  });
});
