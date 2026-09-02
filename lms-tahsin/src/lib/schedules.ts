import { prisma } from "@/lib/prisma";
import { ForbiddenError, isAdmin } from "@/lib/auth-guard";
import type { SessionUser } from "@/lib/auth-guard";
import { PrivateAssignmentStatus } from "@/generated/prisma/enums";

/** "16:00" -> 960 menit sejak tengah malam. */
export function toMinutes(startTime: string): number {
  const [hour, minute] = startTime.split(":").map(Number);
  return hour * 60 + minute;
}

/** 960 + 60 -> "17:00". Dipakai hanya untuk tampilan. */
export function addMinutesToTime(startTime: string, minutes: number): string {
  const total = toMinutes(startTime) + minutes;
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

type Window = { startTime: string; durationMinutes: number };

/** Dua slot bentrok bila rentang [mulai, selesai) saling menimpa. */
export function timeOverlaps(a: Window, b: Window): boolean {
  const startA = toMinutes(a.startTime);
  const startB = toMinutes(b.startTime);
  return startA < startB + b.durationMinutes && startB < startA + a.durationMinutes;
}

type DateRange = { effectiveFrom: Date | null; effectiveUntil: Date | null };

/**
 * null berarti terbuka: effectiveFrom null = sudah berlaku sejak kapan pun,
 * effectiveUntil null = berlaku sampai dicabut. Dua jadwal baru benar-benar
 * bentrok kalau masa berlakunya juga beririsan.
 */
export function dateRangeOverlaps(a: DateRange, b: DateRange): boolean {
  if (a.effectiveUntil && b.effectiveFrom && a.effectiveUntil < b.effectiveFrom) {
    return false;
  }
  if (b.effectiveUntil && a.effectiveFrom && b.effectiveUntil < a.effectiveFrom) {
    return false;
  }
  return true;
}

export type ConflictCandidate = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  teacher: { fullName: string };
  student: { fullName: string };
};

/**
 * Cari jadwal aktif yang bentrok, baik di sisi guru (tidak bisa mengajar dua
 * murid sekaligus) maupun sisi murid (tidak bisa hadir di dua tempat).
 * excludeId dipakai saat mengubah jadwal supaya tidak bentrok dengan dirinya.
 */
export async function findScheduleConflict(params: {
  teacherId: string;
  studentId: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  excludeId?: string;
}): Promise<ConflictCandidate | null> {
  const candidates = await prisma.privateRecurringSchedule.findMany({
    where: {
      isActive: true,
      dayOfWeek: params.dayOfWeek,
      OR: [{ teacherId: params.teacherId }, { studentId: params.studentId }],
      ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
    },
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      durationMinutes: true,
      effectiveFrom: true,
      effectiveUntil: true,
      teacher: { select: { fullName: true } },
      student: { select: { fullName: true } },
    },
  });

  return (
    candidates.find(
      (c) =>
        timeOverlaps(params, c) &&
        dateRangeOverlaps(params, c),
    ) ?? null
  );
}

/**
 * Guru hanya boleh menjadwalkan murid yang memang ditugaskan kepadanya
 * (PrivateAssignment aktif dari alur Blok D). Admin bebas.
 */
export async function assertCanScheduleFor(
  actor: SessionUser,
  teacherId: string,
  studentId: string,
): Promise<void> {
  if (isAdmin(actor)) return;
  if (actor.id !== teacherId) throw new ForbiddenError();

  const assignment = await prisma.privateAssignment.findUnique({
    where: { teacherId_studentId: { teacherId, studentId } },
    select: { status: true },
  });
  if (!assignment || assignment.status === PrivateAssignmentStatus.ended) {
    throw new ForbiddenError(
      "Murid ini bukan murid privat Anda yang aktif",
    );
  }
}

/** Kolom jadwal untuk daftar di API maupun halaman guru. */
export const SCHEDULE_SELECT = {
  id: true,
  teacherId: true,
  studentId: true,
  dayOfWeek: true,
  startTime: true,
  durationMinutes: true,
  meetingUrl: true,
  isActive: true,
  effectiveFrom: true,
  effectiveUntil: true,
  teacher: { select: { fullName: true } },
  student: { select: { fullName: true } },
};

/** Form mengirim "" untuk tanggal kosong; kolom Date butuh null. */
export function toDateOrNull(value: string | undefined): Date | null {
  return value && value.length > 0 ? new Date(value) : null;
}
