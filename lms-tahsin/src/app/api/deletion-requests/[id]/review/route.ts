import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import {
  DELETION_STATUS,
  deletionExecuteAfter,
  isPendingReview,
} from "@/lib/account-deletion";
import { eligibilityForUser } from "@/lib/deletion-requests";
import { RoleName } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/**
 * Admin meninjau permintaan hapus akun yang diajukan orang tua (NFR-6).
 *
 * Menyetujui TIDAK menghapus apa pun di sini. Ia hanya memindahkan permintaan
 * ke status `pending` dan mengisi executeAfter, yaitu keadaan yang memang
 * sudah disapu cron process-deletions. Satu jalur anonimisasi saja untuk
 * seluruh sistem — tidak ada logika penghapusan kedua yang bisa menyimpang.
 */

const reviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"], { error: "Keputusan wajib dipilih" }),
    reason: z
      .union([
        z.string().trim().max(500, "Alasan maksimal 500 karakter"),
        z.literal(""),
      ])
      .optional(),
  })
  .refine(
    (value) => value.decision !== "reject" || Boolean(value.reason?.trim()),
    { path: ["reason"], error: "Alasan penolakan wajib diisi" },
  );

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const admin = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await context.params;

    const body: unknown = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { decision, reason } = parsed.data;

    const request = await prisma.accountDeletionRequest.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!request) {
      return apiError("Permintaan tidak ditemukan", 404);
    }
    if (!isPendingReview(request.status)) {
      return apiError(
        "Permintaan ini sudah tidak menunggu tinjauan admin",
        409,
      );
    }

    if (decision === "reject") {
      await prisma.accountDeletionRequest.update({
        where: { id: request.id },
        data: {
          status: DELETION_STATUS.blocked,
          blockedBy: admin.id,
          blockedReason: reason?.trim() ?? null,
        },
      });
      return apiOk({ status: DELETION_STATUS.blocked });
    }

    // Kelayakan diperiksa ULANG di sini, bukan hanya saat pengajuan: tagihan
    // baru bisa terbit selama permintaan mengantre, dan menyetujui saat itu
    // akan menganonimkan orang yang masih punya tanggungan.
    const eligibility = await eligibilityForUser(request.userId);
    if (!eligibility.allowed) {
      return apiError(eligibility.reason ?? "Tidak bisa dihapus", 422);
    }

    const approvedAt = new Date();
    await prisma.accountDeletionRequest.update({
      where: { id: request.id },
      data: {
        status: DELETION_STATUS.pending,
        // Tenggang berjalan dari KEPUTUSAN. Kalau dihitung dari pengajuan,
        // admin yang meninjau tiga hari kemudian diam-diam memakan separuh
        // jendela keluarga itu untuk berubah pikiran.
        executeAfter: deletionExecuteAfter(approvedAt),
      },
    });

    return apiOk({
      status: DELETION_STATUS.pending,
      executeAfter: deletionExecuteAfter(approvedAt).toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
