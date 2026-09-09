import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { attendanceReportFilename, attendanceReportToCsv } from "@/lib/reports";
import { computeReportCards } from "@/lib/report-card-data";
import { classGroupReportQuerySchema } from "@/lib/validations/report";

/** U+FEFF di awal berkas — tanpanya Excel Windows salah menebak encoding. */
const UTF8_BOM = "﻿";

/**
 * CSV rekap kehadiran satu class group (spec B4 §4.7).
 *
 * Admin bebas; guru hanya untuk kelas yang diampunya sendiri.
 * SENGAJA tanpa pagination: ini ekspor, bukan daftar untuk dibaca di layar.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const url = new URL(req.url);
    const parsed = classGroupReportQuerySchema.safeParse({
      classGroupId: url.searchParams.get("classGroupId") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Filter tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { classGroupId } = parsed.data;

    await assertCanAccessClassGroup(user, classGroupId);

    const group = await prisma.classGroup.findUnique({
      where: { id: classGroupId },
      select: { name: true },
    });
    if (!group) return apiError("Kelas tidak ditemukan", 404);

    // computeReportCards() sudah menghitung tally (present/late/excused/absent)
    // per murid dari definisi "sesi yang benar-benar berlangsung" (BR-02.6a).
    // TIDAK mengkueri ulang SessionAttendance di sini — itu menduplikasi
    // definisi itu di dua tempat yang bisa menyimpang seiring waktu.
    //
    // CSV INI SENGAJA SELALU MEMAKAI ANGKA HIDUP, TIDAK PERNAH SNAPSHOT BEKU
    // — beda dengan /api/reports/report-cards (yang untuk baris `published`
    // wajib memakai snapshot ReportCard/ReportCardScore, karena pernah
    // terbukti CSV berlabel `published` melaporkan nilai akhir yang berbeda
    // dari rapor yang sudah dicetak). Rekap ini BUKAN artefak rapor: ia
    // menjawab "bagaimana kehadiran sejauh ini" secara operasional, tidak
    // punya kolom status yang menjanjikan kebekuan, dan tidak dijamin cocok
    // dengan rapor mana pun. JANGAN "menyeragamkan" route ini dengan pola
    // frozen di atas — itu akan menyembunyikan kehadiran hari ini di balik
    // angka rapor lama untuk kelas yang rapornya sudah terbit.
    const computations = await computeReportCards(classGroupId);

    const rows = computations.map((c) => ({
      studentName: c.studentName,
      present: c.tally.present,
      late: c.tally.late,
      excused: c.tally.excused,
      absent: c.tally.absent,
      sessionsHeld: c.sessionsHeld,
      attendancePct: c.attendancePct,
    }));

    return new NextResponse(UTF8_BOM + attendanceReportToCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${attendanceReportFilename(group.name)}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
