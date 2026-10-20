import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { HttpError, handleApiError, requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { TX_OPTIONS } from "@/lib/users";
import {
  publishedReportCardNoteSchema,
  reportCardPatchSchema,
} from "@/lib/validations/report-card";
import { ReportCardStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/** "" / spasi saja berarti MENGHAPUS teksnya, bukan menyimpan string kosong. */
const text = (value: string | undefined): string | null | undefined =>
  value === undefined ? undefined : value.trim() ? value.trim() : null;

/**
 * Narasi guru dan timpaan nilai akhir pada satu rapor (spec B4 §4.4).
 *
 * DUA JALUR, dan perbedaannya adalah inti rilis ini:
 *
 * - Rapor DRAFT: catatan guru dan timpaan nilai akhir, keduanya bebas diubah.
 * - Rapor TERBIT: HANYA catatan guru. Angka (nilai, kehadiran, kelayakan)
 *   tetap beku dan satu-satunya jalan mengubahnya adalah penerbitan ulang,
 *   yang tercatat di AuditLog.
 *
 * Kenapa narasi dikecualikan dari pembekuan: ia satu-satunya bagian rapor yang
 * murni ditulis manusia. Angka bisa "salah" hanya kalau data di belakangnya
 * salah — dan memperbaikinya memang harus lewat penerbitan ulang supaya orang
 * tua tidak melihat rapor yang diam-diam berubah. Salah ketik pada kalimat
 * guru bukan kasus itu: tidak ada data yang perlu dihitung ulang, dan sebelum
 * ini tidak ada jalur apa pun untuk memperbaikinya — penerbitan ulang pun
 * hanya menghitung ulang angka dan tak pernah menawarkan penyuntingan teks.
 * Setiap suntingan sesudah terbit dicatat di AuditLog dan ditandai
 * teacherNoteUpdatedAt, sehingga perubahannya terlihat, bukan senyap.
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

    const body: unknown = await req.json();

    // Pra-cek status memilih SKEMA mana yang berlaku, dan hanya itu. Ia bukan
    // wasit boleh-tidaknya menulis — wasitnya ada di masing-masing jalur di
    // bawah (tulisan bersyarat untuk draft, row lock untuk terbit). Status
    // bisa berubah antara baris ini dan penulisannya; yang dijaga adalah agar
    // perubahan itu tidak pernah menghasilkan tulisan yang salah, bukan agar
    // ia tidak pernah terjadi.
    if (card.status === ReportCardStatus.published) {
      return await patchPublishedNote(id, body, user.id);
    }

    const parsed = reportCardPatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { teacherNote, finalGradeOverride, overrideReason } = parsed.data;

    // ============================================================
    // KEPUTUSAN "sudah terbit → jangan tulis angkanya" DAN PENULISANNYA
    // ADALAH SATU PERNYATAAN. JANGAN DIKEMBALIKAN JADI "periksa status di
    // atas, lalu `update` tanpa syarat di sini" — itu BUG YANG PERNAH TERJADI
    // DI SINI, bukan kekhawatiran teoretis, dan pra-cek di atas TIDAK cukup.
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
    // Pelonggaran untuk narasi TIDAK mengubah apa pun di sini: jalur ini tetap
    // menolak menulis ke baris yang sudah terbit, KARENA payload-nya memuat
    // angka. Rapor terbit ditangani patchPublishedNote, yang hanya menyentuh
    // teacherNote.
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
        teacherNoteUpdatedAt: true,
        finalGradeOverride: true,
        overrideReason: true,
      },
    });

    // Tidak ada baris yang tertulis padahal findUnique di atas menemukannya
    // (dan tidak ada jalur mana pun di codebase yang MENGHAPUS ReportCard):
    // satu-satunya sebab adalah statusnya sudah `published` sekarang —
    // penerbitan commit tepat di dalam jendela di atas. Pesannya menyebut
    // JALAN KELUARNYA, bukan sekadar penolakan: sesudah memuat ulang, catatan
    // gurunya masih bisa diperbaiki lewat permintaan yang sama, hanya
    // angkanya yang tidak.
    if (!updated) {
      return apiError(
        "Rapor baru saja terbit, jadi nilainya tidak bisa lagi diubah dari sini. Muat ulang halaman — catatan guru masih bisa diperbaiki.",
        422,
      );
    }

    return apiOk({
      id: updated.id,
      teacherNote: updated.teacherNote,
      teacherNoteUpdatedAt: updated.teacherNoteUpdatedAt,
      finalGradeOverride:
        updated.finalGradeOverride !== null ? Number(updated.finalGradeOverride) : null,
      overrideReason: updated.overrideReason,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Jalur rapor TERBIT: memperbaiki catatan guru, dan tidak menyentuh apa pun
 * yang lain.
 *
 * Dipisah jadi fungsinya sendiri supaya tidak ada satu pun `data:` yang bisa
 * memuat kolom angka di jalur ini — pembekuan dijaga oleh BENTUK kode, bukan
 * oleh kewaspadaan pembacanya nanti.
 */
async function patchPublishedNote(
  id: string,
  body: unknown,
  actorId: string,
): Promise<NextResponse> {
  const parsed = publishedReportCardNoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "Rapor sudah terbit: hanya catatan guru yang masih bisa diperbaiki. Nilai dan kehadiran dibekukan saat penerbitan.",
      422,
      zodFieldErrors(parsed.error),
    );
  }
  const next = text(parsed.data.teacherNote) ?? null;

  // ============================================================
  // ROW LOCK, bukan tulisan bersyarat seperti jalur draft — dan alasannya
  // berbeda dari alasan di sana.
  //
  // Yang dijaga di sini BUKAN "jangan menulis ke baris terbit" (di jalur ini
  // menulis ke baris terbit justru yang diminta), melainkan KEJUJURAN
  // teacherNoteUpdatedAt: penanda itu hanya boleh berubah kalau teksnya
  // benar-benar berbeda dari yang tersimpan. Membandingkan teks lama tanpa
  // lock berarti "baca lalu tulis" biasa: penerbitan ulang yang commit di
  // antaranya (ia mengosongkan teacherNoteUpdatedAt — lihat publish/route.ts)
  // membuat kita menulis penanda berdasarkan perbandingan yang sudah basi,
  // dan orang tua melihat "diperbarui" pada narasi yang tak pernah disunting,
  // atau sebaliknya kehilangan penandanya pada narasi yang disunting.
  //
  // Pola locknya sama persis dengan penerbitan: kunci dulu, BARU baca lewat
  // Prisma, sehingga yang terbaca dijamin versi terbaru. Hanya satu baris yang
  // dikunci dan tidak ada lock kedua yang ditahan, jadi ia tidak bisa
  // berdeadlock dengan penerbitan yang mengunci banyak baris berurutan.
  //
  // AuditLog ditulis di dalam transaksi yang SAMA: catatan perubahan dan
  // perubahannya sendiri tidak boleh pernah berbeda (BR-10.4).
  // ============================================================
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ReportCard" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.reportCard.findUnique({
      where: { id },
      select: { id: true, status: true, teacherNote: true, teacherNoteUpdatedAt: true },
    });
    if (!row) throw new HttpError("Rapor tidak ditemukan", 404);
    if (row.status !== ReportCardStatus.published) {
      // Tidak ada jalur "tarik kembali" di sistem ini, jadi published →
      // draft mestinya mustahil. Dijaga tetap, karena kalau kelak jalur itu
      // ada, diam-diam menulis narasi ke rapor yang sudah kembali draft
      // adalah kegagalan yang tak akan terlihat siapa pun.
      throw new HttpError(
        "Status rapor berubah saat permintaan diproses, muat ulang lalu coba lagi",
        409,
      );
    }

    // Menyimpan teks yang sama persis BUKAN suntingan: tanpa penjagaan ini,
    // guru yang menekan "Simpan" tanpa mengubah apa pun akan memasang
    // penanda "diperbarui" pada rapor yang isinya tidak berubah sedikit pun —
    // dan membuat orang tua mengira ada yang direvisi.
    if (next === row.teacherNote) {
      return {
        teacherNote: row.teacherNote,
        teacherNoteUpdatedAt: row.teacherNoteUpdatedAt,
      };
    }

    const updated = await tx.reportCard.update({
      where: { id },
      data: { teacherNote: next, teacherNoteUpdatedAt: new Date() },
      select: { teacherNote: true, teacherNoteUpdatedAt: true },
    });

    await writeAudit(tx, {
      actorId,
      entity: "ReportCard",
      entityId: id,
      action: "teacher_note_edit",
      oldData: { teacherNote: row.teacherNote },
      newData: { teacherNote: next },
    });

    return updated;
  }, TX_OPTIONS);

  return apiOk({
    id,
    teacherNote: result.teacherNote,
    teacherNoteUpdatedAt: result.teacherNoteUpdatedAt,
  });
}
