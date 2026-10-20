import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as Res } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, zodFieldErrors } from "@/lib/api";
import {
  assertStudentOrGuardian,
  handleApiError,
  requireAuth,
} from "@/lib/auth-guard";
import { loadUserExport } from "@/lib/data-export-loader";

export const dynamic = "force-dynamic";

/**
 * Ekspor data ANAK, diunduh orang tua yang tertaut (NFR-6, hak akses UU PDP).
 *
 * Anak tanpa kata sandi tidak bisa masuk sendiri, jadi tanpa endpoint ini hak
 * aksesnya hanya bisa dipenuhi lewat email manual. Sengaja terpisah dari
 * /api/account/export, yang tidak menerima id sama sekali dan karena itu
 * tidak punya permukaan IDOR — pola yang sama dengan
 * /api/account/family-deletion-request.
 *
 * Kepemilikan dicek dengan assertStudentOrGuardian, BUKAN assertCanAccess:
 * cabang guru di assertCanAccess meloloskan guru yang mengajar murid itu,
 * sedangkan bundel ini memuat tagihan dan pembayaran yang tidak boleh dilihat
 * guru (BR-10.3). Akun yang punya peran guru sekaligus orang tua pun hanya
 * lolos untuk anaknya sendiri.
 */

const targetSchema = z.object({
  studentId: z.string().uuid("Murid tidak valid"),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const parsed = targetSchema.safeParse({
      studentId: new URL(req.url).searchParams.get("studentId") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { studentId } = parsed.data;

    if (studentId === user.id) {
      return apiError("Untuk akun Anda sendiri, pakai tombol unduh data saya.", 422);
    }

    // WAJIB (NFR-2, IDOR): hanya wali yang tertaut dengan murid ini.
    await assertStudentOrGuardian(user, studentId);

    // Akun yang sudah dianonimkan tidak punya data pribadi lagi untuk
    // diekspor. UI memang sudah menyembunyikannya (linkedChildren), tapi
    // endpoint tidak boleh bergantung pada UI.
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

    const bundle = await loadUserExport(studentId);

    // Bukan apiOk: ini berkas unduhan, bukan payload API biasa.
    return Res.json(bundle, {
      headers: {
        "Content-Disposition": `attachment; filename="data-tanafus-${studentId}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
