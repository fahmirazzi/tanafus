import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiOk } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";

/**
 * Tandai semua notifikasi milik pengguna sebagai sudah dibaca
 * (roadmap item 20).
 *
 * Tidak menerima daftar id dari client: pemiliknya diambil dari sesi login,
 * sehingga tidak ada cara menandai notifikasi orang lain (BR-10.1).
 */
export async function PATCH(): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const result = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return apiOk({ marked: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}
