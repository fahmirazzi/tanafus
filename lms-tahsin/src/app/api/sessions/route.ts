import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  hasRole,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import { assertCanScheduleFor } from "@/lib/schedules";
import { assertStudentNotSuspended } from "@/lib/suspension";
import {
  findSessionConflict,
  zonedDateKey,
  zonedDateTimeToUtc,
} from "@/lib/sessions";
import {
  createOneTimeSessionSchema,
  sessionListQuerySchema,
} from "@/lib/validations/session";
import { RoleName, SessionType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const SESSION_SELECT = {
  id: true,
  scheduledAt: true,
  durationMinutes: true,
  status: true,
  meetingUrl: true,
  notes: true,
  teacherId: true,
  studentId: true,
  teacher: { select: { fullName: true } },
  student: { select: { fullName: true } },
};

/** Rentang default bila pemanggil tidak menyebut: 14 hari ke depan. */
const DEFAULT_RANGE_DAYS = 14;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    if (!isAdmin(user) && !hasRole(user, RoleName.teacher)) {
      throw new ForbiddenError();
    }

    const url = new URL(req.url);
    const parsed = sessionListQuerySchema.safeParse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      studentId: url.searchParams.get("studentId") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Filter tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const fromKey = parsed.data.from ?? zonedDateKey(new Date());
    const toKey =
      parsed.data.to ??
      zonedDateKey(new Date(Date.now() + DEFAULT_RANGE_DAYS * 86_400_000));

    // Rentang tanggal lokal diubah ke instan: dari 00:00 hari awal sampai
    // 00:00 hari setelah hari akhir, supaya hari terakhir ikut terhitung.
    const gte = zonedDateTimeToUtc(fromKey, "00:00");
    const lt = new Date(
      zonedDateTimeToUtc(toKey, "00:00").getTime() + 86_400_000,
    );

    const where: Prisma.SessionWhereInput = {
      type: SessionType.private,
      scheduledAt: { gte, lt },
      ...(isAdmin(user) ? {} : { teacherId: user.id }),
      ...(parsed.data.studentId ? { studentId: parsed.data.studentId } : {}),
    };

    const rows = await prisma.session.findMany({
      where,
      select: SESSION_SELECT,
      orderBy: { scheduledAt: "asc" },
      take: 500,
    });

    return apiOk(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Sesi one-time (PRD F-2b) — di luar jadwal berulang, misalnya sesi
 * tambahan atau pengganti. Statusnya langsung `scheduled`.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    if (!isAdmin(user) && !hasRole(user, RoleName.teacher)) {
      throw new ForbiddenError();
    }

    const body: unknown = await req.json();
    const parsed = createOneTimeSessionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { studentId, date, startTime, durationMinutes, meetingUrl, notes } =
      parsed.data;

    const teacherId = isAdmin(user)
      ? (parsed.data.teacherId ? parsed.data.teacherId : null)
      : user.id;
    if (!teacherId) {
      return apiError("Data tidak valid", 422, {
        teacherId: "Pilih guru yang mengajar sesi ini",
      });
    }

    await assertCanScheduleFor(user, teacherId, studentId);
    // BR-04.6: murid yang disuspend tidak boleh dijadwalkan sesi baru.
    await assertStudentNotSuspended(studentId);

    // BR-03.1: durasi tanpa tarif aktif tidak bisa ditagih saat sesi selesai.
    const tier = await prisma.pricingTier.findFirst({
      where: { durationMinutes, isActive: true },
      select: { id: true },
    });
    if (!tier) {
      return apiError("Data tidak valid", 422, {
        durationMinutes: `Belum ada tarif aktif untuk durasi ${durationMinutes} menit`,
      });
    }

    const scheduledAt = zonedDateTimeToUtc(date, startTime);
    if (scheduledAt.getTime() < Date.now()) {
      return apiError("Tidak bisa membuat sesi di waktu yang sudah lewat", 422);
    }

    const conflict = await findSessionConflict({
      teacherId,
      studentId,
      scheduledAt,
      durationMinutes,
    });
    if (conflict) {
      const who =
        conflict.side === "teacher"
          ? `Anda sudah mengajar ${conflict.student?.fullName ?? "murid lain"}`
          : `${conflict.student?.fullName ?? "Murid ini"} sudah ada sesi`;
      return apiError(
        `${who} pada waktu yang beririsan. Pilih jam lain.`,
        422,
      );
    }

    try {
      const created = await prisma.session.create({
        data: {
          type: SessionType.private,
          teacherId,
          studentId,
          scheduledAt,
          durationMinutes,
          meetingUrl: meetingUrl?.trim() ? meetingUrl.trim() : null,
          notes: notes?.trim() ? notes.trim() : null,
          createdBy: user.id,
        },
        select: { id: true },
      });
      return apiOk({ id: created.id }, { status: 201 });
    } catch (error) {
      // unique (studentId, scheduledAt) juga mencakup sesi yang sudah
      // dibatalkan, sehingga jam persis yang sama tidak bisa dipakai ulang.
      // Pengecekan bentrok di atas sengaja mengabaikan sesi batal, jadi
      // kasus sempit ini dijelaskan di sini alih-alih jatuh jadi 500.
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: string }).code === "P2002"
      ) {
        return apiError(
          "Murid ini pernah punya sesi pada jam persis itu (termasuk yang dibatalkan). Geser beberapa menit.",
          422,
        );
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
