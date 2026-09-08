import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { reportCardPatchSchema } from "@/lib/validations/report-card";
import { ReportCardStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Narasi guru dan timpaan nilai akhir pada satu rapor (spec B4 §4.4).
 *
 * Hanya berlaku selama draft. Rapor yang sudah terbit tidak bisa disunting
 * sama sekali — satu-satunya jalan mengubahnya adalah penerbitan ulang, yang
 * tercatat di AuditLog.
 */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const card = await prisma.reportCard.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        enrollment: { select: { classGroupId: true } },
      },
    });
    if (!card) return apiError("Rapor tidak ditemukan", 404);

    await assertCanAccessClassGroup(user, card.enrollment.classGroupId);

    // Pra-cek murni untuk MENOLAK LEBIH CEPAT (tanpa membaca body dari
    // jaringan) rapor yang jelas-jelas sudah terbit. Ini BUKAN wasitnya —
    // wasitnya adalah tulisan bersyarat di bawah. Lihat blok komentar di sana
    // sebelum menyederhanakan apa pun di antara keduanya.
    if (card.status === ReportCardStatus.published) {
      return apiError(
        "Rapor sudah terbit dan tidak bisa disunting. Terbitkan ulang bila perlu diubah.",
        422,
      );
    }

    const body: unknown = await req.json();
    const parsed = reportCardPatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { teacherNote, finalGradeOverride, overrideReason } = parsed.data;

    const text = (value: string | undefined): string | null | undefined =>
      value === undefined ? undefined : value.trim() ? value.trim() : null;

    // ============================================================
    // KEPUTUSAN "sudah terbit → tolak" DAN PENULISANNYA ADALAH SATU
    // PERNYATAAN. JANGAN DIKEMBALIKAN JADI "periksa status di atas, lalu
    // `update` tanpa syarat di sini" — itu BUG YANG PERNAH TERJADI DI SINI,
    // bukan kekhawatiran teoretis, dan pra-cek di atas TIDAK cukup.
    //
    // Di antara pra-cek status dan baris ini ada assertCanAccessClassGroup
    // (satu round-trip DB), `await req.json()` (pembacaan body dari
    // jaringan), dan parsing Zod — jendela yang bahkan lebih panjang
    // daripada jendela serupa di POST /class-groups/[id]/report-cards. Kalau
    // transaksi penerbitan commit di dalam jendela itu, `update` tanpa syarat
    // akan menulis teacherNote/finalGradeOverride/overrideReason ke rapor
    // yang SUDAH TERBIT. Akibatnya bukan sekadar kolom kotor: GET
    // /api/class-groups/[id]/report-cards mengembalikan finalGradeOverride
    // TANPA memandang `frozen`, sehingga rapor terbit langsung menampilkan
    // nilai akhir yang berbeda dari yang dibekukan, sementara
    // Enrollment.finalGrade — yang ditulis penerbitan dari override LAMA —
    // jadi basi dan bertentangan dengan yang ditampilkan.
    //
    // `updateMany` bersyarat `status: { not: published }` menutupnya: bila
    // penerbitan sedang memegang row lock, pernyataan ini menunggu, lalu
    // Postgres MENGEVALUASI ULANG WHERE-nya terhadap versi baris terbaru
    // (EvalPlanQual) — baris yang sudah jadi `published` tidak tertulis dan
    // count-nya 0. Varian ...AndReturn dipakai supaya baris hasilnya ikut
    // kembali dari pernyataan yang SAMA: tidak ada pembacaan susulan yang
    // bisa dipisahkan lagi dari tulisannya.
    // ============================================================
    const [updated] = await prisma.reportCard.updateManyAndReturn({
      where: { id, status: { not: ReportCardStatus.published } },
      data: {
        ...(teacherNote !== undefined ? { teacherNote: text(teacherNote) } : {}),
        ...(finalGradeOverride !== undefined
          ? {
              finalGradeOverride,
              // Menghapus timpaan ikut menghapus alasannya: alasan tanpa
              // timpaan adalah catatan yang menjelaskan sesuatu yang tidak ada.
              overrideReason:
                finalGradeOverride === null ? null : text(overrideReason) ?? null,
            }
          : {}),
      },
      select: {
        id: true,
        teacherNote: true,
        finalGradeOverride: true,
        overrideReason: true,
      },
    });

    // Tidak ada baris yang tertulis padahal findUnique di atas menemukannya
    // (dan tidak ada jalur mana pun di codebase yang MENGHAPUS ReportCard):
    // satu-satunya sebab adalah statusnya sudah `published` sekarang. Pesan
    // dan kodenya sengaja identik dengan pra-cek di atas — dari sisi
    // pemanggil, balapan ini tidak terlihat berbeda dari kasus biasa.
    if (!updated) {
      return apiError(
        "Rapor sudah terbit dan tidak bisa disunting. Terbitkan ulang bila perlu diubah.",
        422,
      );
    }

    return apiOk({
      id: updated.id,
      teacherNote: updated.teacherNote,
      finalGradeOverride:
        updated.finalGradeOverride !== null ? Number(updated.finalGradeOverride) : null,
      overrideReason: updated.overrideReason,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
