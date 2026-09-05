import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import { activeRoster } from "@/lib/class-groups";
import { missingFromRoster } from "@/lib/attendance";
import { attendanceSchema } from "@/lib/validations/class";
import { TX_OPTIONS } from "@/lib/users";
import { SessionType } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Kehadiran kohort untuk sesi kelas reguler (Task 7, spec B1 §5.3).
 *
 * PUT menyimpan seluruh roster sekaligus — satu perjalanan jaringan untuk
 * dua belas murid, bukan dua belas — karena layar ini paling sering dipakai
 * guru dan BR-02.6a menjadikan kehadiran gerbang kenaikan level: layar yang
 * terasa lambat akan diakali, bukan dipakai.
 */
export async function PUT(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        classGroupId: true,
        teacherId: true,
        substituteTeacherId: true,
      },
    });
    if (!session) return apiError("Sesi tidak ditemukan", 404);
    if (session.type !== SessionType.regular || !session.classGroupId) {
      return apiError("Sesi ini bukan sesi kelas reguler", 422);
    }

    // Hanya guru sesi itu sendiri (termasuk guru pengganti) atau admin yang
    // boleh menandai kehadiran.
    const isOwnTeacher =
      user.id === session.teacherId || user.id === session.substituteTeacherId;
    if (!isAdmin(user) && !isOwnTeacher) throw new ForbiddenError();

    const body: unknown = await req.json();
    const parsed = attendanceSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const roster = await activeRoster(session.classGroupId);
    const rosterIds = new Set(roster.map((r) => r.studentId));

    // Murid yang sudah dikeluarkan dari kelas bisa saja masih terkirim dari
    // layar yang basi (roster berubah setelah layar dibuka); tandanya
    // diabaikan, bukan disimpan dan tidak dihitung melengkapi roster.
    const marks = parsed.data.marks.filter((m) => rosterIds.has(m.studentId));
    if (marks.length === 0) {
      return apiError(
        "Tidak ada murid pada roster yang cocok dengan kiriman ini",
        422,
      );
    }

    const now = new Date();
    const markedBy = user.id;

    // Upsert per murid lewat unique (sessionId, studentId) yang sudah ada,
    // semuanya di dalam satu transaksi supaya penandaan roster tidak pernah
    // tersimpan setengah-setengah.
    await prisma.$transaction(async (tx) => {
      for (const mark of marks) {
        await tx.sessionAttendance.upsert({
          where: {
            sessionId_studentId: { sessionId: id, studentId: mark.studentId },
          },
          create: {
            sessionId: id,
            studentId: mark.studentId,
            status: mark.status,
            excuseReason: mark.excuseReason ? mark.excuseReason : null,
            markedAt: now,
            markedBy,
          },
          update: {
            status: mark.status,
            excuseReason: mark.excuseReason ? mark.excuseReason : null,
            markedAt: now,
            markedBy,
          },
        });
      }
    }, TX_OPTIONS);

    const missing = missingFromRoster(
      roster.map((r) => r.studentId),
      marks,
    );

    return apiOk({
      sessionId: id,
      marked: marks.length,
      rosterComplete: missing.length === 0,
      missing,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
