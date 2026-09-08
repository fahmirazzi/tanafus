import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { HttpError, handleApiError, requireRole } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { createNotifications, sendEventEmail } from "@/lib/notifications";
import { hasBlockers } from "@/lib/report-card";
import { computeReportCards, publishBlockersFor } from "@/lib/report-card-data";
import { TX_OPTIONS } from "@/lib/users";
import { publishReportCardsSchema } from "@/lib/validations/report-card";
import { ReportCardStatus, RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Penerbitan rapor satu class group (spec B4 §4.4).
 *
 * ADMIN SAJA — guru menyusun draft dan menarasikan (POST /report-cards,
 * PATCH /report-cards/[id]), admin yang menerbitkan.
 *
 * Seluruh draft dihitung ulang lalu dibekukan dalam SATU transaksi: tidak
 * ada kelas yang separuh terbit. Setelah beku, mengoreksi nilai atau
 * kehadiran di belakangnya TIDAK mengubah rapor sama sekali (GET
 * /report-cards membaca kolom yang dibekukan, PATCH menolak rapor
 * published) — satu-satunya jalan mengubahnya adalah menerbitkan ulang
 * lewat endpoint ini dengan confirm eksplisit, dan itu tercatat di AuditLog.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json().catch(() => ({}));
    const parsed = publishReportCardsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const confirm = parsed.data.confirm === true;

    // computeReportCards dipanggil SEKALI di sini, lalu hasilnya diteruskan
    // ke publishBlockersFor alih-alih membiarkannya menghitung ulang sendiri
    // (parameter kedua itu ada justru untuk ini — lihat catatan di
    // report-card-data.ts). Kelas dengan banyak murid berarti banyak kueri
    // kehadiran+nilai; menjalankannya dua kali untuk data yang identik pada
    // endpoint yang paling sering dipakai admin adalah pemborosan yang
    // sudah ditegur di review Task 5.
    const computations = await computeReportCards(id);
    if (computations.length === 0) {
      return apiError("Kelas ini belum punya murid terdaftar", 422);
    }

    // Ketiga gerbang publikasi (spec B4 §4.4) diperiksa di SETIAP penerbitan,
    // termasuk penerbitan ulang — kewajiban make-up baru atau sesi basi baru
    // bisa saja muncul setelah penerbitan pertama.
    const blockers = await publishBlockersFor(id, computations);
    if (hasBlockers(blockers)) {
      // Daftar penghalangnya ikut dikirim: admin harus bisa bertindak
      // langsung dari pesan errornya sendiri, bukan menebak sesi/murid mana
      // yang bermasalah.
      return apiError("Rapor belum bisa diterbitkan", 422, blockers);
    }

    const existing = await prisma.reportCard.findMany({
      where: { enrollment: { classGroupId: id } },
      select: { id: true, enrollmentId: true, status: true },
    });

    // Kueri di atas mengambil rapor SELURUH enrollment kelas ini, termasuk
    // yang sudah `dropped`, sedangkan computations hanya `active`/`suspended`
    // (lihat computeReportCards). Tanpa penyaringan ini, satu murid yang
    // di-drop SETELAH rapornya terbit membuat kelas yang belum pernah terbit
    // sama sekali menuntut confirm: true dan tombolnya berbunyi "Terbitkan
    // ulang" — padahal rapor yang akan ditulis di bawah tidak menyentuh
    // baris murid itu sedikit pun. Penyaringan di sisi JS, bukan di where:
    // definisi "enrollment yang masuk rapor" hanya boleh hidup di satu
    // tempat, dan tempat itu computeReportCards.
    const inScope = new Set(computations.map((c) => c.enrollmentId));
    const relevant = existing.filter((r) => inScope.has(r.enrollmentId));
    const byEnrollment = new Map(relevant.map((r) => [r.enrollmentId, r]));

    const missingDraft = computations.filter(
      (c) => !byEnrollment.has(c.enrollmentId),
    );
    if (missingDraft.length > 0) {
      // Endpoint ini murni membekukan draft yang SUDAH ada (disusun lewat
      // POST /report-cards) — bukan menyusunnya. Murid tanpa draft berarti
      // draft class group ini belum pernah/baru disusun ulang.
      return apiError("Masih ada murid yang belum punya draft rapor", 422, {
        studentsWithoutDraft: missingDraft.map((c) => ({
          studentId: c.studentId,
          fullName: c.studentName,
        })),
      });
    }

    const alreadyPublished = relevant.filter(
      (r) => r.status === ReportCardStatus.published,
    );
    if (alreadyPublished.length > 0 && !confirm) {
      return apiError(
        "Rapor kelas ini sudah pernah terbit. Kirim confirm: true untuk menerbitkan ulang.",
        409,
        { alreadyPublished: alreadyPublished.length },
      );
    }

    const publishedAt = new Date();
    const results: Array<{
      enrollmentId: string;
      studentId: string;
      studentName: string;
      action: "publish" | "republish";
    }> = [];

    // ============================================================
    // POLA KONKURENSI (peringatan review Task 5) — JANGAN SEDERHANAKAN.
    //
    // `existing`/`alreadyPublished` di atas dibaca SEBELUM transaksi ini
    // dibuka, sekadar untuk pesan error yang cepat tanpa membuka transaksi
    // untuk kasus yang sudah pasti gagal. Antara pembacaan itu dan baris di
    // bawah, admin lain bisa saja menekan tombol terbitkan/terbitkan-ulang
    // yang sama untuk class group yang sama secara bersamaan. Tanpa
    // penguncian baris, kedua permintaan akan sama-sama lolos pengecekan
    // confirm di atas (keduanya membaca status LAMA yang identik), lalu
    // sama-sama menimpa ReportCard + Enrollment.finalGrade + AuditLog —
    // menghasilkan DUA baris audit "publish" untuk satu penerbitan, dan
    // hasil akhirnya ditentukan siapa yang COMMIT belakangan (bukan siapa
    // yang mengirim confirm).
    //
    // `SELECT ... FOR UPDATE` per baris di bawah mengunci ReportCard begitu
    // transaksi kita mulai memprosesnya. Transaksi kedua yang mencoba
    // mengunci baris yang sama akan MENUNGGU sampai kita commit, baru
    // membaca status TERBARU (published) lewat findUnique sesudahnya —
    // sehingga pengecekan confirm di dalam transaksi (bukan yang di atas)
    // yang jadi wasit sebenarnya, dan permintaan kedua yang tanpa confirm
    // akan ditolak 409 alih-alih diam-diam menerbitkan ulang.
    //
    // LINGKUP pola ini, dan siapa yang menjaga sisanya: lock di sini adalah
    // wasit balapan ANTAR permintaan endpoint INI. Penulis rapor yang lain —
    // POST /api/class-groups/[id]/report-cards (penyusun draft) dan PATCH
    // /api/report-cards/[id] (narasi & timpaan nilai) — TIDAK bergantung
    // pada lock ini: keduanya memakai tulisan BERSYARAT
    // `status: { not: published }` dalam satu pernyataan, sehingga Postgres
    // mengevaluasi ulang syaratnya terhadap versi baris terbaru begitu lock
    // kita terlepas (EvalPlanQual) dan tidak menulis apa pun ke rapor yang
    // sementara itu menjadi terbit. Jadi invarian "rapor terbit hanya berubah
    // lewat penerbitan ulang" ditegakkan di TIGA berkas sekaligus, bukan
    // hanya di sini.
    //
    // Konsekuensinya untuk pembaca berikutnya: perlindungan di berkas mana
    // pun dari ketiganya tidak boleh dilepas dengan alasan "toh yang lain
    // sudah menjaga". Lock di sini tidak menggantikan tulisan bersyarat di
    // sana (ia tidak mengunci baris yang belum ada, mis. draft pertama yang
    // sedang disisipkan), dan tulisan bersyarat di sana tidak menggantikan
    // lock di sini (status `published` → `published` pada penerbitan ulang
    // adalah tulisan yang sah, jadi tidak ada syarat status yang bisa
    // memisahkan dua penerbitan yang berbalapan).
    // ============================================================
    await prisma.$transaction(async (tx) => {
      for (const c of computations) {
        const draftId = byEnrollment.get(c.enrollmentId)!.id;

        await tx.$queryRaw`SELECT "id" FROM "ReportCard" WHERE "id" = ${draftId} FOR UPDATE`;
        // Dibaca LEWAT PRISMA setelah lock di atas berhasil didapat, bukan
        // sebelumnya — begitu lock ini kita pegang, tidak ada transaksi lain
        // yang bisa mengubah baris ini sampai kita commit/rollback, jadi
        // pembacaan berikutnya ini dijamin mencerminkan keadaan TERBARU.
        const row = await tx.reportCard.findUnique({
          where: { id: draftId },
          select: { id: true, status: true, finalGradeOverride: true },
        });
        if (!row) {
          throw new HttpError(
            "Draft rapor menghilang saat penerbitan diproses, coba lagi",
            409,
          );
        }
        if (row.status === ReportCardStatus.published && !confirm) {
          throw new HttpError(
            "Rapor kelas ini baru saja diterbitkan oleh permintaan lain. Kirim confirm: true untuk menerbitkan ulang.",
            409,
          );
        }

        await tx.reportCard.update({
          where: { id: row.id },
          data: {
            attendancePct: c.attendancePct,
            sessionsHeld: c.sessionsHeld,
            sessionsAttended: c.sessionsAttended,
            finalGradeComputed: c.finalGradeComputed,
            attendanceThresholdPct: c.attendanceThresholdPct,
            eligibleForNextLevel: c.eligibleForNextLevel,
            status: ReportCardStatus.published,
            publishedAt,
            publishedBy: user.id,
          },
        });

        // ReportCardScore lama dibersihkan sebelum ditulis ulang, supaya
        // kriteria yang nilainya sekarang hilang (mis. guru menghapus satu
        // penilaian sebelum kelas terbit) tidak tertinggal sebagai baris
        // hantu dari hitungan lama.
        await tx.reportCardScore.deleteMany({ where: { reportCardId: row.id } });
        if (c.averages.length > 0) {
          await tx.reportCardScore.createMany({
            data: c.averages.map((a) => ({
              reportCardId: row.id,
              criterionId: a.criterionId,
              averageScore: a.averageScore,
              sessionsScored: a.sessionsScored,
            })),
          });
        }

        // Enrollment.finalGrade adalah RINGKASAN yang bisa dibaca tanpa join
        // (mis. daftar murid per kelas) — bukan sumber kebenaran kedua.
        // Satu-satunya tempat field ini ditulis adalah di sini, dan hanya
        // dari nilai efektif (override menang atas hitungan) — satu
        // penulis, satu arah.
        const effective =
          row.finalGradeOverride !== null
            ? Number(row.finalGradeOverride)
            : c.finalGradeComputed;
        await tx.enrollment.update({
          where: { id: c.enrollmentId },
          data: { finalGrade: effective },
        });

        const action =
          row.status === ReportCardStatus.published ? "republish" : "publish";
        await writeAudit(tx, {
          actorId: user.id,
          entity: "ReportCard",
          entityId: row.id,
          action,
          newData: {
            attendancePct: c.attendancePct,
            finalGradeComputed: c.finalGradeComputed,
            finalGrade: effective,
            eligibleForNextLevel: c.eligibleForNextLevel,
          },
        });

        results.push({
          enrollmentId: c.enrollmentId,
          studentId: c.studentId,
          studentName: c.studentName,
          action,
        });
      }
    }, TX_OPTIONS);

    // BR-09: notifikasi dan email dikirim SETELAH transaksi di atas commit,
    // TIDAK dibungkus di dalamnya — sama seperti POST /sessions/[id]/feedback.
    // Mengirim email adalah panggilan jaringan ke Resend; kalau ditahan di
    // dalam transaksi, kelambatan/kegagalan Resend bisa membuat penerbitan
    // yang sudah sah ikut gagal atau timeout karenanya.
    //
    // KUERI AUDIENS DIBATCH, ISI PESAN TETAP PER MURID — ini bukan sekadar
    // optimasi. Versi paling awal menjalankan getStudentAudienceIds satu per
    // satu per murid: kelas 15 murid berarti 15 round-trip database hanya
    // untuk audiens, di atas permintaan yang memang sudah panjang. Yang
    // dibatch di bawah adalah KUERI itu (satu parentStudent.findMany untuk
    // seluruh kelas) dan pengiriman JARINGAN emailnya (per gelombang kecil,
    // lihat komentar EMAIL_WAVE_SIZE) — bukan badan notifikasinya, yang
    // sengaja tetap dibuat per murid (lihat "ISI NOTIFIKASI SENGAJA PER
    // MURID" di bawah). Mode gagal yang tetap dijaga: bila proses ini
    // kehabisan waktu, transaksinya SUDAH commit — rapor betul-betul terbit
    // meski admin melihat kegagalan, lalu percobaan ulangnya berbenturan 409
    // dan mendorongnya mengirim confirm: true, yaitu penerbitan ulang yang
    // tidak pernah ia maksudkan, lengkap dengan baris AuditLog "republish"
    // palsu dan notifikasi ganda ke orang tua.
    //
    // Seluruh blok dibungkus SATU try/catch: kegagalan mengabari siapa pun
    // tidak boleh membuat admin mengira PENERBITANNYA gagal, padahal sudah
    // commit dan tidak bisa (serta tidak perlu) dibatalkan.
    try {
      const studentIds = results.map((r) => r.studentId);

      // Satu kueri untuk audiens SEKELAS, bukan satu per murid — ini bagian
      // yang memang benar dari batching sebelumnya dan tetap dipertahankan:
      // yang mahal di sini adalah KUERI-nya, bukan ISI pesannya (lihat
      // catatan "ISI NOTIFIKASI SENGAJA PER MURID" di bawah).
      const links = await prisma.parentStudent.findMany({
        where: { studentId: { in: studentIds } },
        select: { studentId: true, parentId: true },
      });
      const parentsByStudent = new Map<string, string[]>();
      for (const link of links) {
        const list = parentsByStudent.get(link.studentId);
        if (list) list.push(link.parentId);
        else parentsByStudent.set(link.studentId, [link.parentId]);
      }

      // KONKURENSI EMAIL DIBATASI PER GELOMBANG KECIL — bukan satu per satu,
      // dan bukan pula seluruh kelas sekaligus. Versi sebelumnya menjalankan
      // Promise.allSettled atas SELURUH murid dalam satu kelas: untuk kelas
      // 15 murid itu tercatat ~45 permintaan Resend hampir bersamaan (tiap
      // murid bisa punya beberapa wali), dan sendEventEmail menelan 429
      // diam-diam sehingga kegagalannya tak pernah terlihat admin. Memproses
      // 5 murid per gelombang menjaga throughput tanpa membanjiri kuota API.
      const EMAIL_WAVE_SIZE = 5;
      for (let i = 0; i < results.length; i += EMAIL_WAVE_SIZE) {
        const wave = results.slice(i, i + EMAIL_WAVE_SIZE);
        await Promise.allSettled(
          wave.map(async (r) => {
            const audience = [
              r.studentId,
              ...(parentsByStudent.get(r.studentId) ?? []),
            ];

            // ISI NOTIFIKASI SENGAJA PER MURID — JANGAN DIGABUNG lagi jadi
            // satu createNotifications tingkat kelas. Rapor adalah dokumen
            // per anak: wali dengan DUA anak di kelas yang sama harus
            // menerima DUA notifikasi berbeda, masing-masing menyebut nama
            // anaknya. Gelombang perbaikan sebelumnya sempat menggabungkan
            // ini jadi satu badan pesan tingkat kelas demi satu panggilan
            // createNotifications — itu regresi yang terlihat pengguna
            // (nama murid hilang, wali dua-anak cuma dapat satu notifikasi)
            // dan sudah dibatalkan di sini. createNotifications dipanggil
            // sekali per murid karena insert lokalnya murah (createMany
            // kecil per panggilan); yang mahal — kueri audiens dan
            // panggilan jaringan email — tetap dibatch di atas dan di
            // gelombang ini.
            await createNotifications(prisma, {
              userIds: audience,
              type: "report_card_published",
              title: "Rapor periode sudah terbit",
              body: `Rapor ${r.studentName} sudah bisa dilihat dan diunduh di halaman progres.`,
              data: {
                classGroupId: id,
                enrollmentId: r.enrollmentId,
                studentId: r.studentId,
              },
            });

            // Email tetap per murid untuk alasan yang sama (nama anak di
            // badan pesan). sendEventEmail sendiri sudah menelan galatnya
            // dan tidak pernah throw; allSettled di sini adalah jaring
            // kedua bila kelak tidak lagi, dan membungkusnya per murid
            // berarti satu kegagalan (notifikasi maupun email) tidak
            // menghentikan pemrosesan murid lain dalam gelombang yang sama.
            await sendEventEmail(audience, {
              subject: "Rapor periode sudah terbit",
              title: "Rapor periode sudah terbit",
              body: `Rapor ${r.studentName} sudah bisa dilihat dan diunduh di halaman progres.`,
            });
          }),
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "report_card_publish_notify_failed",
          classGroupId: id,
          error: String(error),
        }),
      );
    }

    return apiOk({
      published: results.length,
      republished: results.some((r) => r.action === "republish"),
      publishedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
