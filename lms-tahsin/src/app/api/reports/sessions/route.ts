import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import {
  sessionsReportFilename,
  sessionsReportToCsv,
  type SessionReportRow,
} from "@/lib/reports";
import { zonedDateTimeToUtc } from "@/lib/sessions";
import { sessionsReportQuerySchema } from "@/lib/validations/report";
import { RoleName, SessionType } from "@/generated/prisma/enums";

/** U+FEFF di awal berkas — tanpanya Excel Windows salah menebak encoding
 * dan merusak tampilan nama yang memuat huruf beraksen. */
const UTF8_BOM = "﻿";

/**
 * Unduhan CSV sesi & pendapatan per periode (roadmap item 28, PRD F-8).
 *
 * Admin-only, dan sengaja bukan JSON: browser mengunduh berkas langsung
 * lewat navigasi biasa (klik tautan), tanpa JavaScript perantara, sehingga
 * berfungsi sama di semua browser tanpa kode fetch+blob di sisi klien.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);

    const url = new URL(req.url);
    const parsed = sessionsReportQuerySchema.safeParse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Filter tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { from, to } = parsed.data;

    // Rentang tanggal lokal (WIB) diubah ke instan UTC: dari 00:00 hari awal
    // sampai 00:00 hari setelah hari akhir, supaya hari terakhir ikut penuh.
    const gte = zonedDateTimeToUtc(from, "00:00");
    const lt = new Date(zonedDateTimeToUtc(to, "00:00").getTime() + 86_400_000);

    // SENGAJA tanpa pagination: ini ekspor CSV, bukan daftar untuk dibaca di
    // layar. Memenggalnya per 20 baris justru merusak berkas hasil ekspor.
    // NFR-1 mewajibkan pagination untuk LIST, bukan untuk ekspor.
    const sessions = await prisma.session.findMany({
      where: {
        type: SessionType.private,
        scheduledAt: { gte, lt },
      },
      select: {
        scheduledAt: true,
        durationMinutes: true,
        status: true,
        teacher: { select: { fullName: true } },
        substitute: { select: { fullName: true } },
        student: { select: { fullName: true } },
        charge: { select: { amount: true } },
        earning: { select: { amount: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    const rows: SessionReportRow[] = sessions.map((session) => ({
      scheduledAt: session.scheduledAt,
      durationMinutes: session.durationMinutes,
      status: session.status,
      teacherName: session.teacher?.fullName ?? "—",
      substituteTeacherName: session.substitute?.fullName ?? null,
      studentName: session.student?.fullName ?? "—",
      chargeAmount: session.charge ? Number(session.charge.amount) : null,
      earningAmount: session.earning ? Number(session.earning.amount) : null,
    }));

    const body = UTF8_BOM + sessionsReportToCsv(rows);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sessionsReportFilename(from, to)}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
