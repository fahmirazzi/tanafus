import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Tandai satu notifikasi sudah dibaca (roadmap item 20).
 *
 * Kepemilikan ikut ke dalam klausa where, bukan dicek lebih dulu lalu
 * di-update: satu query berarti tidak ada celah antara pengecekan dan
 * penulisan, dan notifikasi milik orang lain jatuh sebagai 404 tanpa
 * membocorkan bahwa idnya ada.
 */
export async function PATCH(
  _req: Request,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const result = await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      return apiError("Notifikasi tidak ditemukan", 404);
    }

    return apiOk({ id, read: true });
  } catch (error) {
    return handleApiError(error);
  }
}
