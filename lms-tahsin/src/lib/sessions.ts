import { prisma } from "@/lib/prisma";
import { OCCUPYING_STATUSES } from "@/lib/validations/session";
import { zonedDayOfWeek } from "@/lib/zoned-date";

/**
 * Helper tanggal murni dipindah ke `@/lib/zoned-date` (lihat berkas itu)
 * supaya modul murni lain bisa memakainya tanpa ikut menyeret prisma.
 * Re-export di sini supaya semua pemanggil lama tidak perlu diubah.
 */
export {
  zonedDateKey,
  zonedDayOfWeek,
  zonedDateTimeToUtc,
  upcomingDateKeys,
  dateKeyWithinRange,
} from "@/lib/zoned-date";

// --- bentrok sesi konkret ---

export type SessionConflict = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  teacher: { fullName: string } | null;
  student: { fullName: string } | null;
  side: "teacher" | "student";
};

/**
 * Cari sesi yang waktunya menimpa slot baru, di sisi guru maupun murid.
 *
 * Hanya sesi berstatus "menduduki" yang dihitung — sesi yang dibatalkan
 * membebaskan waktunya kembali. Slot yang bersentuhan ujung (16:00-17:00
 * lalu 17:00-17:45) TIDAK dianggap bentrok, sama seperti aturan pada
 * jadwal berulang.
 */
export async function findSessionConflict(params: {
  teacherId: string;
  studentId: string;
  scheduledAt: Date;
  durationMinutes: number;
  excludeId?: string;
}): Promise<SessionConflict | null> {
  const startMs = params.scheduledAt.getTime();
  const endMs = startMs + params.durationMinutes * 60_000;

  // Ambil kandidat di sekitar slot; durasi maksimum 240 menit sehingga
  // jendela 4 jam ke belakang sudah pasti menangkap semua yang mungkin.
  const candidates = await prisma.session.findMany({
    where: {
      status: { in: OCCUPYING_STATUSES },
      OR: [{ teacherId: params.teacherId }, { studentId: params.studentId }],
      scheduledAt: {
        gte: new Date(startMs - 240 * 60_000),
        lt: new Date(endMs),
      },
      ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
    },
    select: {
      id: true,
      teacherId: true,
      studentId: true,
      scheduledAt: true,
      durationMinutes: true,
      teacher: { select: { fullName: true } },
      student: { select: { fullName: true } },
    },
  });

  const hit = candidates.find((c) => {
    const cStart = c.scheduledAt.getTime();
    const cEnd = cStart + c.durationMinutes * 60_000;
    return startMs < cEnd && cStart < endMs;
  });
  if (!hit) return null;

  return {
    id: hit.id,
    scheduledAt: hit.scheduledAt,
    durationMinutes: hit.durationMinutes,
    teacher: hit.teacher,
    student: hit.student,
    side: hit.teacherId === params.teacherId ? "teacher" : "student",
  };
}

/**
 * Seorang guru tidak boleh terjadwal ganda LINTAS tipe. Pengecekan yang ada
 * hanya melihat jadwal privat; kelas reguler menambah sumber bentrok kedua.
 *
 * Keterbatasan yang disadari (sama seperti pengecekan privat): pembandingnya
 * adalah sesi yang sudah tergenerate plus template jadwal aktif, bukan simulasi
 * penuh setiap kemunculan sampai akhir periode.
 */
export async function findTeacherSlotConflict(input: {
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  ignoreClassGroupId?: string;
}): Promise<{ kind: "private" | "regular"; label: string } | null> {
  const privateHit = await prisma.privateRecurringSchedule.findFirst({
    where: {
      teacherId: input.teacherId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      isActive: true,
    },
    select: { student: { select: { fullName: true } } },
  });
  if (privateHit) {
    return {
      kind: "private",
      label: `jadwal privat dengan ${privateHit.student.fullName}`,
    };
  }

  const regularHit = await prisma.classGroupSchedule.findFirst({
    where: {
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      isActive: true,
      classGroup: {
        teacherId: input.teacherId,
        ...(input.ignoreClassGroupId
          ? { id: { not: input.ignoreClassGroupId } }
          : {}),
      },
    },
    select: { classGroup: { select: { name: true } } },
  });
  if (regularHit) {
    return { kind: "regular", label: `kelas ${regularHit.classGroup.name}` };
  }

  return null;
}

// --- navigasi mingguan ---

/** Geser sebuah kunci tanggal "YYYY-MM-DD" sekian hari. */
export function addDaysToKey(dateKey: string, days: number): string {
  // Tengah hari UTC dipakai sebagai jangkar supaya penambahan hari tidak
  // pernah tergelincir oleh zona waktu.
  const anchor = new Date(`${dateKey}T12:00:00.000Z`);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toISOString().slice(0, 10);
}

/** Senin pada pekan yang memuat tanggal tersebut. */
export function startOfWeekKey(dateKey: string): string {
  const dow = zonedDayOfWeek(dateKey); // 0 = Minggu
  const backToMonday = dow === 0 ? 6 : dow - 1;
  return addDaysToKey(dateKey, -backToMonday);
}

/** Tujuh kunci tanggal mulai Senin pekan tersebut. */
export function weekKeys(dateKey: string): string[] {
  const monday = startOfWeekKey(dateKey);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i));
}
