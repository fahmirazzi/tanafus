import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import {
  assertStudentOrGuardian,
  handleApiError,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import { renderReportCardPdf } from "@/lib/report-card-pdf/render";
import { ReportCardStatus } from "@/generated/prisma/enums";

// @react-pdf/renderer dan fontkit membaca berkas dari disk — wajib Node,
// bukan Edge.
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Unduhan PDF rapor (spec B4 §4.6). Hanya rapor yang sudah terbit. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const card = await prisma.reportCard.findUnique({
      where: { id },
      select: {
        status: true,
        attendancePct: true,
        sessionsHeld: true,
        sessionsAttended: true,
        attendanceThresholdPct: true,
        eligibleForNextLevel: true,
        finalGradeComputed: true,
        finalGradeOverride: true,
        teacherNote: true,
        publishedAt: true,
        scores: {
          select: {
            averageScore: true,
            sessionsScored: true,
            criterion: { select: { name: true } },
          },
          orderBy: { criterionId: "asc" },
        },
        enrollment: {
          select: {
            studentId: true,
            student: { select: { fullName: true } },
            classGroup: {
              select: {
                name: true,
                teacherId: true,
                course: { select: { name: true } },
                period: { select: { name: true, startDate: true, endDate: true } },
              },
            },
          },
        },
      },
    });
    if (!card) return apiError("Rapor tidak ditemukan", 404);

    // Rapor draft tidak pernah terlihat siapa pun di luar guru dan admin.
    // 404, bukan 403: keberadaan rapor draft murid tidak boleh bocor ke
    // murid/wali lewat perbedaan kode status (spec B4 §4.6).
    if (card.status !== ReportCardStatus.published) {
      return apiError("Rapor tidak ditemukan", 404);
    }

    const isOwnTeacher = user.id === card.enrollment.classGroup.teacherId;
    if (!isAdmin(user) && !isOwnTeacher) {
      // Sengaja BUKAN assertCanAccess: cabang guru di sana meloloskan guru
      // privat murid ini untuk pelajaran LAIN (lewat PrivateAssignment/
      // Session/PrivateRecurringSchedule), padahal spec B4 §4.4 cuma
      // mengizinkan empat pihak (admin, guru kelas ITU, murid, wali) — di
      // luar admin & guru kelas yang sudah ditangani di atas, sisanya HANYA
      // murid itu sendiri atau walinya. Lihat komentar assertStudentOrGuardian
      // di auth-guard.ts untuk alasan lengkap kenapa ini bukan pemakaian ulang
      // assertCanAccess.
      await assertStudentOrGuardian(user, card.enrollment.studentId);
    }

    const buffer = await renderReportCardPdf({
      studentName: card.enrollment.student.fullName,
      className: card.enrollment.classGroup.name,
      courseName: card.enrollment.classGroup.course.name,
      periodName: card.enrollment.classGroup.period.name,
      periodStart: card.enrollment.classGroup.period.startDate,
      periodEnd: card.enrollment.classGroup.period.endDate,
      attendancePct: card.attendancePct !== null ? Number(card.attendancePct) : null,
      sessionsHeld: card.sessionsHeld,
      sessionsAttended: card.sessionsAttended,
      thresholdPct: Number(card.attendanceThresholdPct),
      eligible: card.eligibleForNextLevel,
      // Nilai efektif: timpaan guru menang bila ada, sesuai aturan yang
      // sama dipakai di PATCH dan penerbitan (spec B4 §4.4).
      finalGrade:
        card.finalGradeOverride !== null
          ? Number(card.finalGradeOverride)
          : card.finalGradeComputed !== null
            ? Number(card.finalGradeComputed)
            : null,
      scores: card.scores.map((s) => ({
        name: s.criterion.name,
        averageScore: Number(s.averageScore),
        sessionsScored: s.sessionsScored,
      })),
      teacherNote: card.teacherNote,
      // publishedAt tidak pernah null pada status published (invariant
      // penerbitan), tapi kolomnya nullable di skema — fallback ini murni
      // untuk memuaskan tipe, bukan jalur yang diharapkan terpakai.
      publishedAt: card.publishedAt ?? new Date(),
    });

    // Kelas karakternya SENGAJA tidak lagi memakai \s: \s mencakup \r dan \n,
    // sehingga nama ber-baris-baru ikut utuh ke dalam nilai header
    // Content-Disposition di bawah — bentuk header-injection yang tidak layak
    // lolos ke main, apa pun kemungkinan hasil akhirnya di runtime. Yang
    // dipertahankan hanya huruf/angka/underscore, spasi, dan tanda hubung.
    //
    // Cadangan id rapor bila hasil sanitasinya kosong: nama beraksara
    // non-Latin (Arab, Han) habis tersaring dan menghasilkan berkas bernama
    // "rapor-.pdf" yang sama untuk setiap murid seperti itu.
    const sanitized = card.enrollment.student.fullName
      .replace(/[^\w -]/g, "")
      .trim();
    const safeName = sanitized === "" ? id : sanitized;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapor-${safeName}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
