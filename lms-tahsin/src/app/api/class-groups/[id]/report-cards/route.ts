import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { computeReportCards, publishBlockersFor } from "@/lib/report-card-data";
import { TX_OPTIONS } from "@/lib/users";
import { ReportCardStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Draft rapor satu class group (spec B4 §4.4).
 *
 * GET selalu menghitung ulang: selama masih draft, rapor mengikuti data di
 * belakangnya. Begitu published, angkanya beku dan yang dikembalikan adalah
 * snapshot yang tersimpan.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;
    await assertCanAccessClassGroup(user, id);

    // computeReportCards dihitung SEKALI di sini lalu diberikan ke
    // publishBlockersFor — tanpa ini, setiap GET menjalankan findUnique +
    // kedua findMany di computeReportCards dua kali untuk data yang identik.
    const [existing, computations] = await Promise.all([
      prisma.reportCard.findMany({
        where: { enrollment: { classGroupId: id } },
        select: {
          id: true,
          enrollmentId: true,
          status: true,
          teacherNote: true,
          finalGradeOverride: true,
          overrideReason: true,
          publishedAt: true,
          attendancePct: true,
          sessionsHeld: true,
          sessionsAttended: true,
          finalGradeComputed: true,
          attendanceThresholdPct: true,
          eligibleForNextLevel: true,
          scores: { select: { criterionId: true, averageScore: true, sessionsScored: true } },
        },
      }),
      computeReportCards(id),
    ]);
    const blockers = await publishBlockersFor(id, computations);

    const byEnrollment = new Map(existing.map((r) => [r.enrollmentId, r]));

    const cards = computations.map((c) => {
      const row = byEnrollment.get(c.enrollmentId);
      const frozen = row?.status === ReportCardStatus.published;
      return {
        reportCardId: row?.id ?? null,
        enrollmentId: c.enrollmentId,
        studentId: c.studentId,
        studentName: c.studentName,
        status: row?.status ?? null,
        publishedAt: row?.publishedAt ?? null,
        teacherNote: row?.teacherNote ?? null,
        overrideReason: row?.overrideReason ?? null,
        finalGradeOverride:
          row?.finalGradeOverride !== null && row?.finalGradeOverride !== undefined
            ? Number(row.finalGradeOverride)
            : null,
        // Rapor terbit menampilkan apa yang dibekukan, bukan hitungan hari ini.
        attendancePct: frozen
          ? row.attendancePct !== null
            ? Number(row.attendancePct)
            : null
          : c.attendancePct,
        sessionsHeld: frozen ? row.sessionsHeld : c.sessionsHeld,
        sessionsAttended: frozen ? row.sessionsAttended : c.sessionsAttended,
        finalGradeComputed: frozen
          ? row.finalGradeComputed !== null
            ? Number(row.finalGradeComputed)
            : null
          : c.finalGradeComputed,
        attendanceThresholdPct: frozen
          ? Number(row.attendanceThresholdPct)
          : c.attendanceThresholdPct,
        eligibleForNextLevel: frozen ? row.eligibleForNextLevel : c.eligibleForNextLevel,
        averages: frozen
          ? row.scores.map((s) => ({
              criterionId: s.criterionId,
              averageScore: Number(s.averageScore),
              sessionsScored: s.sessionsScored,
            }))
          : c.averages,
      };
    });

    return apiOk({
      cards,
      blockers,
      // Peringatan, BUKAN penghalang: konsekuensi sadar dari "penilaian tidak
      // wajib" (spec B4 §4.4).
      warnings: {
        studentsWithoutScores: cards
          .filter((c) => c.averages.length === 0)
          .map((c) => ({ studentId: c.studentId, fullName: c.studentName })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Menyusun draft untuk seluruh enrollment aktif. Idempoten lewat
 * enrollmentId @unique: menekan tombolnya dua kali tidak menggandakan apa pun,
 * dan draft yang sudah ada disegarkan angkanya.
 *
 * Enrollment `suspended` TETAP mendapat rapor — suspensi adalah urusan
 * tagihan (BR-04.6a/6b), bukan pernyataan tentang capaian belajar.
 */
export async function POST(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;
    await assertCanAccessClassGroup(user, id);

    const computations = await computeReportCards(id);
    if (computations.length === 0) {
      return apiError("Kelas ini belum punya murid terdaftar", 422);
    }

    let created = 0;
    let refreshed = 0;
    let skippedPublished = 0;

    await prisma.$transaction(async (tx) => {
      for (const c of computations) {
        const data = {
          attendancePct: c.attendancePct,
          sessionsHeld: c.sessionsHeld,
          sessionsAttended: c.sessionsAttended,
          finalGradeComputed: c.finalGradeComputed,
          attendanceThresholdPct: c.attendanceThresholdPct,
          eligibleForNextLevel: c.eligibleForNextLevel,
        };
        const notPublished = {
          enrollmentId: c.enrollmentId,
          status: { not: ReportCardStatus.published },
        };

        // ============================================================
        // KEPUTUSAN "sudah terbit → lewati" DAN PENULISANNYA ADALAH SATU
        // PERNYATAAN. JANGAN DIPECAH LAGI JADI "periksa dulu, tulis
        // kemudian" — itu BUG YANG PERNAH TERJADI DI SINI, bukan
        // kekhawatiran teoretis.
        //
        // Versi sebelumnya membaca status lewat `findUnique`, memutuskan
        // skip, lalu menulis lewat `upsert` yang payload-nya tidak pernah
        // memuat kolom `status`. Isolasi transaksi di sini Read Committed
        // (TX_OPTIONS tidak menyetel isolationLevel), jadi urutan berikut
        // sah terjadi: `findUnique` membaca "draft" → transaksi penerbitan
        // commit → `upsert` (yang sempat memblokir di row lock milik
        // penerbitan) MELANJUTKAN TANPA SYARAT di atas versi baris terbaru.
        // Akibatnya attendancePct/sessionsHeld/sessionsAttended/
        // finalGradeComputed/attendanceThresholdPct/eligibleForNextLevel
        // pada rapor yang BARU SAJA TERBIT tertimpa (status tetap
        // `published`, tapi angkanya bukan lagi yang dibekukan) dan
        // Enrollment.finalGrade tidak lagi cocok dengan isi rapornya.
        // Jendela rentannya bukan jarak antara dua pernyataan itu, melainkan
        // SELURUH durasi transaksi penerbitan.
        //
        // `updateMany` bersyarat `status: { not: published }` menutupnya
        // sampai ke akar: begitu row lock penerbitan terlepas, Postgres
        // MENGEVALUASI ULANG WHERE-nya terhadap versi baris terbaru
        // (EvalPlanQual), jadi baris yang sementara itu jadi `published`
        // tidak ikut tertulis dan count-nya 0. Tidak ada celah yang bisa
        // disisipi apa pun, karena keputusan dan penulisannya adalah
        // pernyataan yang sama.
        // ============================================================
        const [updatedRow] = await tx.reportCard.updateManyAndReturn({
          where: notPublished,
          data,
          select: { id: true },
        });

        let cardId: string;

        if (updatedRow) {
          refreshed += 1;
          cardId = updatedRow.id;
        } else {
          // count === 0 punya DUA arti: barisnya sudah terbit, ATAU barisnya
          // memang belum ada (draft pertama untuk enrollment ini). Insert
          // yang mengabaikan duplikat (INSERT ... ON CONFLICT DO NOTHING,
          // dijaga unique constraint enrollmentId) membedakan keduanya tanpa
          // melempar. JANGAN diganti `create` + try/catch: exception di
          // dalam transaksi Postgres membatalkan SELURUH transaksi, jadi
          // satu tabrakan akan menjatuhkan draft seluruh murid sekelas.
          const inserted = await tx.reportCard.createMany({
            data: [{ enrollmentId: c.enrollmentId, ...data }],
            skipDuplicates: true,
          });

          if (inserted.count > 0) {
            created += 1;
            // Barisnya baru saja KITA sisipkan di dalam transaksi ini, jadi
            // row lock-nya ada di tangan kita sampai commit: pembacaan id ini
            // tidak bisa dibalap siapa pun, dan ia TIDAK ikut menentukan
            // boleh-tidaknya menulis (baris baru selalu berstatus `draft`) —
            // jadi ini bukan "periksa dulu, tulis kemudian" yang dilarang di
            // atas, hanya pengambilan kunci asing untuk skor di bawah.
            const insertedRow = await tx.reportCard.findUniqueOrThrow({
              where: { enrollmentId: c.enrollmentId },
              select: { id: true },
            });
            cardId = insertedRow.id;
          } else {
            // Barisnya ada, tapi tidak tersentuh updateMany di atas. Dua
            // kemungkinan: sudah `published` (memang harus dilewati), atau
            // permintaan POST lain baru saja membuat draft-nya di antara dua
            // pernyataan kita. Satu percobaan bersyarat lagi memisahkannya
            // secara pasti — kalau kali ini pun tidak ada baris yang
            // tertulis, barisnya ADA dan bukan draft, berarti published.
            const [retriedRow] = await tx.reportCard.updateManyAndReturn({
              where: notPublished,
              data,
              select: { id: true },
            });
            if (!retriedRow) {
              // Rapor yang sudah terbit TIDAK disentuh — hanya penerbitan
              // ulang yang boleh mengubahnya (spec B4 §4.4).
              skippedPublished += 1;
              continue;
            }
            refreshed += 1;
            cardId = retriedRow.id;
          }
        }

        // deleteMany + createMany di bawah HANYA berjalan untuk baris yang
        // benar-benar kita tulis di atas: baris published selalu berakhir di
        // cabang `skippedPublished` dan tidak pernah sampai ke sini, jadi
        // skor yang sudah beku tidak pernah dihapus lalu ditulis ulang.
        // Sesudah tulisan bersyarat itu berhasil, transaksi ini memegang row
        // lock ReportCard-nya sampai commit — penerbitan tidak bisa
        // menyelinap di antara penghapusan dan penulisan ulang skor.
        await tx.reportCardScore.deleteMany({ where: { reportCardId: cardId } });
        if (c.averages.length > 0) {
          await tx.reportCardScore.createMany({
            data: c.averages.map((a) => ({
              reportCardId: cardId,
              criterionId: a.criterionId,
              averageScore: a.averageScore,
              sessionsScored: a.sessionsScored,
            })),
          });
        }
      }
    }, TX_OPTIONS);

    return apiOk({ created, refreshed, skippedPublished });
  } catch (error) {
    return handleApiError(error);
  }
}
