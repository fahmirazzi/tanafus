import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Permintaan hapus akun anak menerima studentId dari client, jadi punya
 * permukaan IDOR. Test ini memakai assertStudentOrGuardian yang asli; hanya
 * sesi login dan Prisma yang dipalsukan.
 *
 * Kasus guru sengaja menyiapkan penugasan privat yang AKTIF: dengan
 * assertCanAccess, guru itu akan lolos lewat isTeacherOf. Test ini memastikan
 * jalur tersebut tetap tertutup.
 */

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    parentStudent: { findUnique: vi.fn() },
    privateAssignment: { findUnique: vi.fn() },
    session: { findFirst: vi.fn() },
    privateRecurringSchedule: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    invoice: { count: vi.fn() },
    sessionEarning: { count: vi.fn() },
    accountDeletionRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { DELETE, POST } from "./route";

const db = mocks.prisma;
const URL_BASE = "http://localhost/api/account/family-deletion-request";

function loginAs(id: string, roles: string[]): void {
  mocks.auth.mockResolvedValue({ user: { id, roles } });
}

function postRequest(studentId: string): NextRequest {
  return new NextRequest(URL_BASE, {
    method: "POST",
    body: JSON.stringify({ studentId }),
    headers: { "Content-Type": "application/json" },
  });
}

function deleteRequest(studentId: string | null): NextRequest {
  const url = new URL(URL_BASE);
  if (studentId !== null) url.searchParams.set("studentId", studentId);
  return new NextRequest(url, { method: "DELETE" });
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

/** Guru yang mengajar childA lewat penugasan privat aktif. */
function teachChild(): void {
  db.privateAssignment.findUnique.mockResolvedValue({ status: "active" });
  db.session.findFirst.mockResolvedValue({ id: "sesi-1" });
}

function expectNoWrite(): void {
  expect(db.accountDeletionRequest.create).not.toHaveBeenCalled();
  expect(db.accountDeletionRequest.update).not.toHaveBeenCalled();
}

const parentA = randomUUID();
const childA = randomUUID();
const parentB = randomUUID();
const teacher = randomUUID();
const admin = randomUUID();

beforeEach(() => {
  vi.resetAllMocks();
  linkParent(parentA, childA);
  db.privateAssignment.findUnique.mockResolvedValue(null);
  db.session.findFirst.mockResolvedValue(null);
  db.privateRecurringSchedule.findFirst.mockResolvedValue(null);
  db.user.findUnique.mockResolvedValue({ deletedAt: null });
  db.invoice.count.mockResolvedValue(0);
  db.sessionEarning.count.mockResolvedValue(0);
  db.accountDeletionRequest.findFirst.mockResolvedValue(null);
  db.accountDeletionRequest.create.mockResolvedValue({
    id: "req-1",
    status: "awaiting_admin",
  });
  db.accountDeletionRequest.update.mockResolvedValue({ id: "req-1" });
});

describe("POST /api/account/family-deletion-request", () => {
  it("menolak guru yang mengajar murid itu (403)", async () => {
    loginAs(teacher, ["teacher"]);
    teachChild();

    const res = await POST(postRequest(childA));

    expect(res.status).toBe(403);
    expectNoWrite();
  });

  it("menolak guru murid itu, walau ia juga berperan orang tua (403)", async () => {
    loginAs(teacher, ["teacher", "parent"]);
    teachChild();

    const res = await POST(postRequest(childA));

    expect(res.status).toBe(403);
    expectNoWrite();
  });

  it("menolak orang tua yang tidak tertaut dengan murid itu (403)", async () => {
    loginAs(parentB, ["parent"]);

    const res = await POST(postRequest(childA));

    expect(res.status).toBe(403);
    expectNoWrite();
  });

  it("meloloskan admin, walau tidak tertaut dengan murid itu (201)", async () => {
    loginAs(admin, ["admin"]);

    const res = await POST(postRequest(childA));

    expect(res.status).toBe(201);
    expect(db.accountDeletionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: childA,
          requestedBy: admin,
          status: "awaiting_admin",
        },
      }),
    );
  });

  it("membuat permintaan awaiting_admin untuk wali yang tertaut (201)", async () => {
    loginAs(parentA, ["parent"]);

    const res = await POST(postRequest(childA));

    expect(res.status).toBe(201);
    expect(db.accountDeletionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: childA,
          requestedBy: parentA,
          status: "awaiting_admin",
        },
      }),
    );
  });

  it("mengarahkan akun sendiri ke endpoint tanpa id (422)", async () => {
    loginAs(parentA, ["parent"]);

    const res = await POST(postRequest(parentA));

    expect(res.status).toBe(422);
    expectNoWrite();
  });

  it("menolak permintaan tanpa login (401)", async () => {
    mocks.auth.mockResolvedValue(null);

    const res = await POST(postRequest(childA));

    expect(res.status).toBe(401);
    expectNoWrite();
  });
});

describe("DELETE /api/account/family-deletion-request", () => {
  beforeEach(() => {
    db.accountDeletionRequest.findFirst.mockResolvedValue({
      id: "req-1",
      status: "awaiting_admin",
      requestedAt: new Date("2026-10-01T00:00:00Z"),
      executeAfter: null,
      requestedBy: parentA,
    });
  });

  it("menolak guru yang mengajar murid itu (403)", async () => {
    loginAs(teacher, ["teacher"]);
    teachChild();

    const res = await DELETE(deleteRequest(childA));

    expect(res.status).toBe(403);
    expectNoWrite();
  });

  it("menolak guru murid itu, walau ia juga berperan orang tua (403)", async () => {
    loginAs(teacher, ["teacher", "parent"]);
    teachChild();

    const res = await DELETE(deleteRequest(childA));

    expect(res.status).toBe(403);
    expectNoWrite();
  });

  it("menolak orang tua yang tidak tertaut dengan murid itu (403)", async () => {
    loginAs(parentB, ["parent"]);

    const res = await DELETE(deleteRequest(childA));

    expect(res.status).toBe(403);
    expectNoWrite();
  });

  it("meloloskan admin, walau tidak tertaut dengan murid itu (200)", async () => {
    loginAs(admin, ["admin"]);

    const res = await DELETE(deleteRequest(childA));

    expect(res.status).toBe(200);
    expect(db.accountDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { status: "cancelled" },
    });
  });

  it("membatalkan permintaan untuk wali yang tertaut (200)", async () => {
    loginAs(parentA, ["parent"]);

    const res = await DELETE(deleteRequest(childA));

    expect(res.status).toBe(200);
    expect(db.accountDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { status: "cancelled" },
    });
  });

  it("mengarahkan akun sendiri ke endpoint tanpa id (422)", async () => {
    loginAs(childA, ["student"]);

    const res = await DELETE(deleteRequest(childA));

    expect(res.status).toBe(422);
    expectNoWrite();
  });

  it("menolak studentId yang kosong (422)", async () => {
    loginAs(parentA, ["parent"]);

    const res = await DELETE(deleteRequest(null));

    expect(res.status).toBe(422);
    expectNoWrite();
  });
});
