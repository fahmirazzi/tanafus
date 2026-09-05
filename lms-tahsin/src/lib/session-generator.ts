import { prisma } from "@/lib/prisma";
import {
  dateKeyWithinRange,
  upcomingDateKeys,
  zonedDateKey,
  zonedDateTimeToUtc,
  zonedDayOfWeek,
} from "@/lib/sessions";
import {
  LeaveStatus,
  SessionType,
  SimpleApprovalStatus,
} from "@/generated/prisma/enums";
import {
  regularCandidateDateKeys,
  shouldSkipClassGroup,
  type RegularCandidate,
} from "@/lib/class-schedule";

export const GENERATOR_WINDOW_DAYS = 14;

export type GenerationSummary = {
  windowDays: number;
  fromDate: string;
  toDate: string;
  schedulesConsidered: number;
  created: number;
  skipped: {
    studentBreak: number;
    suspended: number;
    deletedUser: number;
    alreadyExists: number;
    inThePast: number;
  };
  /** Sesi kelas reguler — dihitung terpisah supaya masalahnya terbaca sendiri. */
  regular: {
    schedulesConsidered: number;
    created: number;
    skipped: {
      classGroupClosed: number;
      noEnrollment: number;
      deletedUser: number;
      alreadyExists: number;
      inThePast: number;
      outsidePeriod: number;
    };
  };
};

/**
 * Membuat sesi konkret 14 hari ke depan dari jadwal berulang (PRD F-2a).
 *
 * WAJIB idempotent: dijalankan dua kali berturut-turut tidak boleh
 * menggandakan sesi. Dijaga di tiga lapis — pengecekan sesi yang sudah ada,
 * skipDuplicates pada createMany, dan unique (studentId, scheduledAt) di DB.
 *
 * Sesi dilewati bila: ada student_break disetujui, murid sedang disuspend
 * karena tunggakan (BR-04.6), slotnya sudah terisi, atau waktunya sudah
 * lewat. Cuti guru panjang TIDAK dicek terpisah di sini — begitu admin
 * menyetujuinya, SEMUA jadwal guru itu langsung dinonaktifkan (BR-06.3),
 * jadi baris itu sudah tidak pernah sampai ke query `isActive: true` di
 * bawah. Satu-satunya jalan sebuah jadwal aktif lagi selama cuti adalah
 * orang tua memilih "substitute" lewat TeacherLeaveCoverage — dan itulah
 * yang justru HARUS tetap menggenerate sesi (dengan substituteTeacherId
 * terpasang), bukan dilewati.
 */
export async function generateUpcomingSessions(
  options: { days?: number; now?: Date } = {},
): Promise<GenerationSummary> {
  const days = options.days ?? GENERATOR_WINDOW_DAYS;
  const now = options.now ?? new Date();
  const dateKeys = upcomingDateKeys(now, days);

  const [schedules, breaks, substituteCoverages, suspended] = await Promise.all([
    prisma.privateRecurringSchedule.findMany({
      where: { isActive: true },
      select: {
        id: true,
        teacherId: true,
        studentId: true,
        dayOfWeek: true,
        startTime: true,
        durationMinutes: true,
        meetingUrl: true,
        effectiveFrom: true,
        effectiveUntil: true,
      },
    }),
    prisma.studentBreak.findMany({
      where: { status: SimpleApprovalStatus.approved },
      select: {
        studentId: true,
        teacherId: true,
        startDate: true,
        endDate: true,
      },
    }),
    // BR-06.4: keluarga yang memilih "substitute" untuk cuti panjang
    // guru mereka — sesi yang jatuh dalam rentang cuti dibubuhi
    // substituteTeacherId begitu dibuat, supaya upahnya mengalir ke
    // pengganti (BR-04.4) tanpa perlu langkah tambahan apa pun.
    prisma.teacherLeaveCoverage.findMany({
      where: {
        choice: "substitute",
        leave: { status: { in: [LeaveStatus.approved, LeaveStatus.active] } },
      },
      select: {
        studentId: true,
        substituteTeacherId: true,
        leave: { select: { teacherId: true, startDate: true, endDate: true } },
      },
    }),
    // BR-04.6: murid yang disuspend tidak boleh dijadwalkan sesi baru. Sesi
    // yang terlanjur ada tetap berjalan — generator hanya berhenti menambah.
    prisma.user.findMany({
      where: { NOT: { suspendedAt: null } },
      select: { id: true },
    }),
  ]);
  const suspendedIds = new Set(suspended.map((student) => student.id));

  // NFR-6: akun yang sudah dianonimkan (deletedAt terisi) tidak boleh
  // dijadwalkan sesi baru sama sekali. Ini lapis pertahanan KEDUA, bukan
  // satu-satunya: account-deletion-executor.ts sudah menonaktifkan
  // PrivateRecurringSchedule milik akun yang dihapus, tapi kalau jaminan itu
  // pernah bolong (bug, race, baris lama sebelum fitur ini ada), generator
  // ini tetap harus berhenti sebelum menagih tagihan ke orang yang sudah
  // tidak bisa login untuk membayarnya. Dicek untuk guru MAUPUN murid,
  // karena keduanya bisa jadi pihak yang dihapus.
  const deleted = await prisma.user.findMany({
    where: { NOT: { deletedAt: null } },
    select: { id: true },
  });
  const deletedIds = new Set(deleted.map((user) => user.id));

  const skipped = {
    studentBreak: 0,
    suspended: 0,
    deletedUser: 0,
    alreadyExists: 0,
    inThePast: 0,
  };

  type Candidate = {
    teacherId: string;
    studentId: string;
    scheduledAt: Date;
    durationMinutes: number;
    meetingUrl: string | null;
    substituteTeacherId: string | null;
  };
  const candidates: Candidate[] = [];

  for (const schedule of schedules) {
    if (suspendedIds.has(schedule.studentId)) {
      skipped.suspended += 1;
      continue;
    }
    if (deletedIds.has(schedule.studentId) || deletedIds.has(schedule.teacherId)) {
      skipped.deletedUser += 1;
      continue;
    }

    for (const dateKey of dateKeys) {
      if (zonedDayOfWeek(dateKey) !== schedule.dayOfWeek) continue;

      if (
        schedule.effectiveFrom &&
        dateKey < zonedDateKey(schedule.effectiveFrom)
      ) {
        continue;
      }
      if (
        schedule.effectiveUntil &&
        dateKey > zonedDateKey(schedule.effectiveUntil)
      ) {
        continue;
      }

      // BR-07.2: libur murid yang disetujui menghentikan generasi sesi.
      // Dicocokkan per pasangan guru-murid, karena murid bisa punya lebih
      // dari satu guru dan liburnya diajukan terhadap guru tertentu.
      const onBreak = breaks.some(
        (b) =>
          b.studentId === schedule.studentId &&
          b.teacherId === schedule.teacherId &&
          dateKeyWithinRange(dateKey, b.startDate, b.endDate),
      );
      if (onBreak) {
        skipped.studentBreak += 1;
        continue;
      }

      const scheduledAt = zonedDateTimeToUtc(dateKey, schedule.startTime);
      // Hari pertama jendela adalah hari ini, jadi slot yang sudah lewat
      // jangan dibuat — sesi masa lalu tidak bisa dihadiri siapa pun.
      if (scheduledAt.getTime() < now.getTime()) {
        skipped.inThePast += 1;
        continue;
      }

      const coverage = substituteCoverages.find(
        (c) =>
          c.leave.teacherId === schedule.teacherId &&
          c.studentId === schedule.studentId &&
          dateKeyWithinRange(dateKey, c.leave.startDate, c.leave.endDate),
      );

      candidates.push({
        teacherId: schedule.teacherId,
        studentId: schedule.studentId,
        scheduledAt,
        durationMinutes: schedule.durationMinutes,
        meetingUrl: schedule.meetingUrl,
        substituteTeacherId: coverage?.substituteTeacherId ?? null,
      });
    }
  }

  // === KANDIDAT REGULER ===
  //
  // CATATAN PENEMPATAN: blok ini sengaja diletakkan SEBELUM `summary` privat
  // dirakit (bukan sesudah dedupe privat) karena blok privat di bawah punya
  // dua `return summary` dini (candidates.length === 0, fresh.length === 0).
  // Kalau kandidat reguler dikumpulkan setelah titik itu, jendela tanpa
  // kandidat privat sama sekali akan membuat reguler tidak pernah diproses.
  // Jalur privat di atas TIDAK diubah sama sekali — hanya titik sisip yang
  // berbeda dari urutan di brief.
  //
  // Sengaja TIDAK mewarisi tiga penyaring milik privat:
  // - StudentBreak: BR-07 ditulis untuk privat, dan sesi kohort tidak bisa
  //   dibatalkan karena satu keluarga pergi.
  // - Suspensi: BR-04.6b — tunggakan memblokir pendaftaran periode berikutnya,
  //   bukan menghentikan kohort yang sedang berjalan.
  // - Cuti panjang guru: kohort tidak punya pilihan per keluarga seperti
  //   BR-06.3; admin memindahkan teacherId atau membatalkan sesinya.
  const classSchedules = await prisma.classGroupSchedule.findMany({
    where: { isActive: true },
    select: {
      classGroupId: true,
      dayOfWeek: true,
      startTime: true,
      durationMinutes: true,
      meetingUrl: true,
      classGroup: {
        select: {
          id: true,
          status: true,
          teacherId: true,
          teacher: { select: { deletedAt: true } },
          period: { select: { startDate: true, endDate: true } },
          _count: { select: { enrollments: { where: { status: "active" } } } },
        },
      },
    },
  });

  const regularSkipped = {
    classGroupClosed: 0,
    noEnrollment: 0,
    deletedUser: 0,
    alreadyExists: 0,
    inThePast: 0,
    outsidePeriod: 0,
  };

  const regularCandidates: RegularCandidate[] = [];

  for (const schedule of classSchedules) {
    const group = schedule.classGroup;

    const skip = shouldSkipClassGroup({
      status: group.status,
      activeEnrollmentCount: group._count.enrollments,
      teacherDeleted: group.teacher.deletedAt !== null,
    });
    if (skip) {
      regularSkipped[skip] += 1;
      continue;
    }

    const matching = regularCandidateDateKeys({
      windowDateKeys: dateKeys,
      dayOfWeek: schedule.dayOfWeek,
      periodStart: zonedDateKey(group.period.startDate),
      periodEnd: zonedDateKey(group.period.endDate),
    });
    regularSkipped.outsidePeriod += dateKeys.filter(
      (key) => zonedDayOfWeek(key) === schedule.dayOfWeek,
    ).length - matching.length;

    for (const dateKey of matching) {
      const scheduledAt = zonedDateTimeToUtc(dateKey, schedule.startTime);
      if (scheduledAt.getTime() < now.getTime()) {
        regularSkipped.inThePast += 1;
        continue;
      }
      regularCandidates.push({
        classGroupId: group.id,
        teacherId: group.teacherId,
        scheduledAt,
        durationMinutes: schedule.durationMinutes,
        meetingUrl: schedule.meetingUrl,
      });
    }
  }

  let regularCreated = 0;

  if (regularCandidates.length > 0) {
    const existingRegular = await prisma.session.findMany({
      where: {
        classGroupId: {
          in: [...new Set(regularCandidates.map((c) => c.classGroupId))],
        },
        scheduledAt: {
          gte: new Date(
            Math.min(...regularCandidates.map((c) => c.scheduledAt.getTime())),
          ),
          lte: new Date(
            Math.max(...regularCandidates.map((c) => c.scheduledAt.getTime())),
          ),
        },
      },
      select: { classGroupId: true, scheduledAt: true },
    });

    const takenRegular = new Set(
      existingRegular.map(
        (s) => `${s.classGroupId}@${s.scheduledAt.getTime()}`,
      ),
    );

    const freshRegular = regularCandidates.filter((c) => {
      const key = `${c.classGroupId}@${c.scheduledAt.getTime()}`;
      if (takenRegular.has(key)) {
        regularSkipped.alreadyExists += 1;
        return false;
      }
      takenRegular.add(key);
      return true;
    });

    if (freshRegular.length > 0) {
      const insertedRegular = await prisma.session.createMany({
        data: freshRegular.map((c) => ({
          type: SessionType.regular,
          classGroupId: c.classGroupId,
          teacherId: c.teacherId,
          scheduledAt: c.scheduledAt,
          durationMinutes: c.durationMinutes,
          meetingUrl: c.meetingUrl,
        })),
        skipDuplicates: true,
      });
      regularCreated = insertedRegular.count;
    }
  }

  const summary: GenerationSummary = {
    windowDays: days,
    fromDate: dateKeys[0] ?? zonedDateKey(now),
    toDate: dateKeys[dateKeys.length - 1] ?? zonedDateKey(now),
    schedulesConsidered: schedules.length,
    created: 0,
    skipped,
    regular: {
      schedulesConsidered: classSchedules.length,
      created: regularCreated,
      skipped: regularSkipped,
    },
  };

  if (candidates.length === 0) return summary;

  // Satu query untuk seluruh jendela, bukan satu per kandidat.
  const existing = await prisma.session.findMany({
    where: {
      studentId: { in: [...new Set(candidates.map((c) => c.studentId))] },
      scheduledAt: {
        gte: new Date(Math.min(...candidates.map((c) => c.scheduledAt.getTime()))),
        lte: new Date(Math.max(...candidates.map((c) => c.scheduledAt.getTime()))),
      },
    },
    select: { studentId: true, scheduledAt: true },
  });
  const taken = new Set(
    existing.map((e) => `${e.studentId}@${e.scheduledAt.getTime()}`),
  );

  const fresh = candidates.filter((c) => {
    const key = `${c.studentId}@${c.scheduledAt.getTime()}`;
    if (taken.has(key)) {
      skipped.alreadyExists += 1;
      return false;
    }
    // Jaga-jaga bila satu jendela memuat dua jadwal pada slot yang sama.
    taken.add(key);
    return true;
  });

  if (fresh.length === 0) return summary;

  const result = await prisma.session.createMany({
    data: fresh.map((c) => ({
      type: SessionType.private,
      teacherId: c.teacherId,
      studentId: c.studentId,
      scheduledAt: c.scheduledAt,
      durationMinutes: c.durationMinutes,
      meetingUrl: c.meetingUrl,
      substituteTeacherId: c.substituteTeacherId,
    })),
    skipDuplicates: true,
  });

  summary.created = result.count;
  return summary;
}
