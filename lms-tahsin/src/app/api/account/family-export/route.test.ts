import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ekspor data anak menerima studentId dari client, jadi inilah satu-satunya
 * jalur ekspor yang punya permukaan IDOR. Test ini memakai assertStudentOrGuardian
 * yang asli; hanya sesi login dan Prisma yang dipalsukan.
 */

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    parentStudent: { findUnique: vi.fn() },
    privateAssignment: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    session: { findMany: vi.fn() },
    sessionGrade: { findMany: vi.fn() },
    sessionFeedback: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { GET } from "./route";

const db = mocks.prisma;

function loginAs(id: string, roles: string[]): void {
  mocks.auth.mockResolvedValue({ user: { id, roles } });
}

function request(studentId: string | null): NextRequest {
  const url = new URL("http://localhost/api/account/family-export");
  if (studentId !== null) url.searchParams.set("studentId", studentId);
  return new NextRequest(url);
}

/** Tautan ParentStudent yang ada di "database" palsu ini. */
function linkParent(parentId: string, studentId: string): void {
  db.parentStudent.findUnique.mockImplementation(
    async (args: {
      where: { parentId_studentId: { parentId: string; studentId: string } };
    }) => {
      const key = args.where.parentId_studentId;
      return key.parentId === parentId && key.studentId === studentId
        ? { parentId }
        : null;
    },
  );
}

function expectNoExportQuery(): void {
  expect(db.user.findUniqueOrThrow).not.toHaveBeenCalled();
  expect(db.session.findMany).not.toHaveBeenCalled();
  expect(db.invoice.findMany).not.toHaveBeenCalled();
  expect(db.payment.findMany).not.toHaveBeenCalled();
}

const parentA = randomUUID();
const childA = randomUUID();
const parentB = randomUUID();
const childB = randomUUID();

beforeEach(() => {
  vi.resetAllMocks();
  linkParent(parentA, childA);
  db.privateAssignment.findUnique.mockResolvedValue(null);
  db.user.findUnique.mockResolvedValue({ deletedAt: null });
  db.user.findUniqueOrThrow.mockResolvedValue({
    id: childA,
    fullName: "Anak A",
    email: null,
    phone: null,
    birthDate: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
  db.session.findMany.mockResolvedValue([]);
  db.sessionGrade.findMany.mockResolvedValue([]);
  db.sessionFeedback.findMany.mockResolvedValue([]);
  db.invoice.findMany.mockResolvedValue([
    {
      id: "inv-1",
      invoiceNumber: "INV-001",
      total: 150000,
      status: "paid",
      issueDate: new Date("2026-02-01T00:00:00Z"),
    },
  ]);
  db.payment.findMany.mockResolvedValue([]);
});

describe("GET /api/account/family-export", () => {
  it("menolak orang tua yang meminta data anak keluarga lain (403)", async () => {
    loginAs(parentB, ["parent"]);

    const res = await GET(request(childA));

    expect(res.status).toBe(403);
    expectNoExportQuery();
  });

  it("menolak orang tua yang menebak id anak yang tidak tertaut (403)", async () => {
    loginAs(parentA, ["parent"]);

    const res = await GET(request(childB));

    expect(res.status).toBe(403);
    expectNoExportQuery();
  });

  it("menolak guru yang mengajar murid itu, walau ia juga berperan orang tua (403)", async () => {
    // assertCanAccess akan meloloskan guru ini lewat penugasan privatnya,
    // padahal bundel memuat tagihan yang tidak boleh dilihat guru (BR-10.3).
    const teacher = randomUUID();
    loginAs(teacher, ["teacher", "parent"]);
    db.privateAssignment.findUnique.mockResolvedValue({ status: "active" });

    const res = await GET(request(childA));

    expect(res.status).toBe(403);
    expectNoExportQuery();
  });

  it("mengirim berkas JSON anak kepada orang tua yang tertaut", async () => {
    loginAs(parentA, ["parent"]);

    const res = await GET(request(childA));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe(
      `attachment; filename="data-tanafus-${childA}.json"`,
    );
    const body = (await res.json()) as {
      profile: { id: string };
      invoices: Array<{ total: number }>;
    };
    expect(body.profile.id).toBe(childA);
    expect(body.invoices).toEqual([
      expect.objectContaining({ total: 150000 }),
    ]);

    // Semua query ekspor terkunci ke anak itu, bukan ke akun orang tuanya.
    expect(db.user.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: childA } }),
    );
    expect(db.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: childA } }),
    );
  });

  it("menolak akun anak yang sudah dianonimkan (409)", async () => {
    loginAs(parentA, ["parent"]);
    db.user.findUnique.mockResolvedValue({ deletedAt: new Date() });

    const res = await GET(request(childA));

    expect(res.status).toBe(409);
    expectNoExportQuery();
  });

  it("mengarahkan ekspor akun sendiri ke endpoint tanpa id (422)", async () => {
    loginAs(parentA, ["parent"]);

    const res = await GET(request(parentA));

    expect(res.status).toBe(422);
    expectNoExportQuery();
  });

  it("menolak studentId yang kosong atau bukan UUID (422)", async () => {
    loginAs(parentA, ["parent"]);

    expect((await GET(request(null))).status).toBe(422);
    expect((await GET(request("bukan-uuid"))).status).toBe(422);
    expectNoExportQuery();
  });

  it("menolak permintaan tanpa login (401)", async () => {
    mocks.auth.mockResolvedValue(null);

    const res = await GET(request(childA));

    expect(res.status).toBe(401);
    expectNoExportQuery();
  });
});
