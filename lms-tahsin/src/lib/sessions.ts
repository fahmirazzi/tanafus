import { prisma } from "@/lib/prisma";
import { timeOverlaps } from "@/lib/time-window";
import { MAX_CLASS_DURATION_MINUTES } from "@/lib/validations/class";
import { OCCUPYING_STATUSES } from "@/lib/validations/session";
import { zonedDateKey, zonedDayOfWeek } from "@/lib/zoned-date";

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

  // Jendela ke belakang harus selebar sesi TERPANJANG yang mungkin ada,
  // bukan selebar sesi yang sedang dibuat. Query ini TIDAK menyaring type dan
  // mencocokkan lewat teacherId, sedangkan sesi reguler juga punya teacherId
  // — jadi kandidatnya termasuk kelas reguler, yang boleh sampai
  // MAX_CLASS_DURATION_MINUTES. Dengan batas 240 menit yang lama, kelas 300
  // menit yang mulai lebih dari 4 jam sebelum sesi baru tidak pernah
  // terambil dan tumpang tindihnya lolos diam-diam.
  //
  // Cukupnya bisa dihitung: tumpang tindih menuntut cStart > startMs - cDur,
  // dan cDur tidak pernah melebihi MAX_CLASS_DURATION_MINUTES.
  const candidates = await prisma.session.findMany({
    where: {
      status: { in: OCCUPYING_STATUSES },
      OR: [{ teacherId: params.teacherId }, { studentId: params.studentId }],
      scheduledAt: {
        gte: new Date(startMs - MAX_CLASS_DURATION_MINUTES * 60_000),
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

export type TeacherSlotConflict = {
  kind: "private" | "regular";
  label: string;
  /** Hanya terisi untuk `kind: "regular"` — dipakai pemanggil yang perlu tahu
   *  apakah yang bentrok adalah kelas itu sendiri atau kelas lain. */
  classGroupId?: string;
};

export type TeacherSlotQuery = {
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  ignoreClassGroupId?: string;
};

/**
 * Slot kelas reguler milik guru yang menimpa jendela waktu yang diminta.
 *
 * `durationMinutes` BENAR-BENAR dipakai: pembandingnya `timeOverlaps`, sama
 * seperti `findScheduleConflict` di sisi privat. Versi lama hanya mencocokkan
 * `startTime` persis, sehingga kelas 60 menit pukul 16:00 lolos begitu saja
 * terhadap jadwal pukul 16:30 — padahal gurunya jelas tidak bisa di dua tempat.
 */
export async function findTeacherRegularSlotConflict(
  input: TeacherSlotQuery,
): Promise<TeacherSlotConflict | null> {
  // AcademicPeriod.endDate bertipe @db.Date, jadi pembandingnya tanggal lokal
  // lembaga pada tengah malam UTC — periode yang berakhir HARI INI tetap
  // terhitung menghalangi.
  const todayLocal = new Date(`${zonedDateKey(new Date())}T00:00:00.000Z`);

  const candidates = await prisma.classGroupSchedule.findMany({
    where: {
      dayOfWeek: input.dayOfWeek,
      isActive: true,
      classGroup: {
        teacherId: input.teacherId,
        // Yang boleh menghalangi hanyalah kelas yang MASIH menghasilkan sesi.
        // Gerbangnya disamakan dengan session-generator (shouldSkipClassGroup
        // + regularCandidateDateKeys): kelas non-"open" dan periode yang sudah
        // lewat tidak pernah membuat sesi lagi. Tanpa syarat ini blokirnya
        // PERMANEN — dan belum ada satu pun endpoint yang bisa menutup atau
        // mengarsipkan class group, jadi tidak ada jalan keluar bagi admin.
        status: "open",
        period: { endDate: { gte: todayLocal } },
        ...(input.ignoreClassGroupId
          ? { id: { not: input.ignoreClassGroupId } }
          : {}),
      },
    },
    select: {
      startTime: true,
      durationMinutes: true,
      classGroup: { select: { id: true, name: true } },
    },
  });

  const hit = candidates.find((c) => timeOverlaps(input, c));
  if (!hit) return null;

  return {
    kind: "regular",
    label: `kelas ${hit.classGroup.name}`,
    classGroupId: hit.classGroup.id,
  };
}

/** Jadwal privat aktif milik guru yang menimpa jendela waktu yang diminta. */
export async function findTeacherPrivateSlotConflict(
  input: TeacherSlotQuery,
): Promise<TeacherSlotConflict | null> {
  const todayLocal = new Date(`${zonedDateKey(new Date())}T00:00:00.000Z`);

  const candidates = await prisma.privateRecurringSchedule.findMany({
    where: {
      teacherId: input.teacherId,
      dayOfWeek: input.dayOfWeek,
      isActive: true,
      // Masa berlaku yang sudah habis tidak boleh memblokir apa pun —
      // penyakit yang sama persis dengan yang disembuhkan di sisi reguler
      // (periode yang sudah lewat), dan tanpa ini gerbangnya cuma benar di
      // satu arah. isActive saja tidak cukup: tidak ada proses yang
      // mematikannya saat effectiveUntil terlewat.
      //
      // effectiveFrom SENGAJA tidak disaring: jadwal yang baru mulai bulan
      // depan tetap komitmen nyata dan memang harus memblokir.
      OR: [
        { effectiveUntil: null },
        { effectiveUntil: { gte: todayLocal } },
      ],
    },
    select: {
      startTime: true,
      durationMinutes: true,
      student: { select: { fullName: true } },
    },
  });

  const hit = candidates.find((c) => timeOverlaps(input, c));
  if (!hit) return null;

  return {
    kind: "private",
    label: `jadwal privat dengan ${hit.student.fullName}`,
  };
}

/**
 * Seorang guru tidak boleh terjadwal ganda LINTAS tipe, DUA ARAH (spec §4):
 * jadwal privat menghalangi slot kelas reguler, dan slot kelas reguler
 * menghalangi jadwal privat.
 *
 * Keterbatasan yang disadari (sama seperti pengecekan privat): pembandingnya
 * adalah template jadwal aktif, bukan simulasi penuh setiap kemunculan sampai
 * akhir periode.
 */
export async function findTeacherSlotConflict(
  input: TeacherSlotQuery,
): Promise<TeacherSlotConflict | null> {
  return (
    (await findTeacherPrivateSlotConflict(input)) ??
    (await findTeacherRegularSlotConflict(input))
  );
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
