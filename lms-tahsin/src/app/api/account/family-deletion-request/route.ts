import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { assertCanAccess, handleApiError, requireAuth } from "@/lib/auth-guard";
import { DELETION_STATUS, canCancelDeletionRequest } from "@/lib/account-deletion";
import {
  activeRequestFor,
  eligibilityForUser,
  linkedChildren,
} from "@/lib/deletion-requests";

export const dynamic = "force-dynamic";

/**
 * Permintaan hapus akun ANAK, diajukan orang tua (NFR-6, spec §4.7).
 *
 * Sengaja terpisah dari /api/account/deletion-request. Endpoint mandiri itu
 * tidak menerima id sama sekali, sehingga tidak punya permukaan IDOR; memaksa
 * jalur orang tua masuk ke sana akan merusak sifat itu. Di sini id memang
 * diperlukan, jadi kepemilikannya dicek lewat assertCanAccess — dan yang
 * dibuat HANYALAH permintaan berstatus `awaiting_admin`, bukan penghapusan.
 * Cron eksekusi hanya menyapu `pending`, jadi tidak ada jalan bagi orang tua
 * untuk menganonimkan akun siapa pun tanpa admin menyetujuinya lebih dulu.
 */

const targetSchema = z.object({
  studentId: z.string().uuid("Murid tidak valid"),
});

/** Daftar anak tertaut beserta status permintaannya — untuk halaman orang tua. */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const children = await linkedChildren(user.id);

    const rows = await Promise.all(
      children.map(async (child) => ({
        ...child,
        request: await activeRequestFor(child.id),
      })),
    );

    return apiOk({ children: rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const body: unknown = await req.json();
    const parsed = targetSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { studentId } = parsed.data;

    // WAJIB (NFR-2, IDOR): hanya wali yang tertaut — atau admin — boleh
    // mengajukan atas nama murid ini.
    await assertCanAccess(user, { kind: "student", studentId });

    if (studentId === user.id) {
      return apiError(
        "Untuk akun Anda sendiri, pakai tombol hapus akun saya.",
        422,
      );
    }

    // Akun yang sudah dianonimkan tidak bisa diajukan lagi. UI memang sudah
    // menyembunyikannya, tapi endpoint tidak boleh bergantung pada UI.
    const target = await prisma.user.findUnique({
      where: { id: studentId },
      select: { deletedAt: true },
    });
    if (!target) {
      return apiError("Murid tidak ditemukan", 404);
    }
    if (target.deletedAt) {
      return apiError("Akun murid ini sudah dihapus", 409);
    }

    const existing = await activeRequestFor(studentId);
    if (existing) {
      return apiError("Permintaan penghapusan untuk murid ini sudah ada", 409);
    }

    const eligibility = await eligibilityForUser(studentId);
    if (!eligibility.allowed) {
      return apiError(eligibility.reason ?? "Tidak bisa dihapus", 422);
    }

    const created = await prisma.accountDeletionRequest.create({
      data: {
        userId: studentId,
        requestedBy: user.id,
        // executeAfter sengaja dibiarkan null: tenggang 7 hari baru mulai
        // berjalan saat admin memutuskan, bukan saat orang tua mengajukan.
        status: DELETION_STATUS.awaitingAdmin,
      },
      select: { id: true, status: true },
    });

    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Orang tua menarik kembali permintaannya, selama belum dieksekusi. */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const studentId = new URL(req.url).searchParams.get("studentId");
    if (!studentId) {
      return apiError("Murid tidak disebutkan", 422);
    }
    await assertCanAccess(user, { kind: "student", studentId });

    const existing = await activeRequestFor(studentId);
    if (!existing || !canCancelDeletionRequest(existing.status)) {
      return apiError("Tidak ada permintaan yang bisa dibatalkan", 404);
    }

    await prisma.accountDeletionRequest.update({
      where: { id: existing.id },
      data: { status: DELETION_STATUS.cancelled },
    });

    return apiOk({ cancelled: 1 });
  } catch (error) {
    return handleApiError(error);
  }
}
