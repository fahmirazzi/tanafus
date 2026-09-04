import { prisma } from "@/lib/prisma";
import {
  createNotifications,
  getStudentAudienceIds,
} from "@/lib/notifications";
import { formatJamWIB } from "@/lib/datetime";
import {
  ReminderKind,
  SessionStatus,
  SessionType,
} from "@/generated/prisma/enums";

/**
 * Jendela pengingat (roadmap item 15, BR-09).
 *
 * Sengaja memakai rentang "mulai sekarang sampai N menit ke depan", bukan
 * "tepat N menit lagi". Cron tidak pernah presisi: kalau jalannya telat atau
 * satu putaran terlewat, pola tepat-waktu akan melewatkan sesi itu selamanya,
 * sedangkan pola rentang tetap menyusul di putaran berikutnya. Unique
 * (sessionId, kind) yang menjaga supaya tidak dobel.
 */
const WINDOWS: { kind: ReminderKind; minutes: number; label: string }[] = [
  { kind: ReminderKind.h1, minutes: 60, label: "satu jam lagi" },
  { kind: ReminderKind.m5, minutes: 5, label: "lima menit lagi" },
];

export type ReminderSummary = {
  sent: Record<string, number>;
  /** Terhalang unique constraint, artinya sudah dikirim eksekusi lain. */
  raced: number;
};

export async function sendDueReminders(
  now: Date = new Date(),
): Promise<ReminderSummary> {
  const summary: ReminderSummary = { sent: {}, raced: 0 };

  for (const window of WINDOWS) {
    const until = new Date(now.getTime() + window.minutes * 60_000);

    const sessions = await prisma.session.findMany({
      where: {
        type: SessionType.private,
        status: SessionStatus.scheduled,
        // Sesi yang sudah lewat tidak perlu diingatkan lagi.
        scheduledAt: { gte: now, lte: until },
        // Filter awal; unique constraint tetap jadi penjaga terakhir.
        reminders: { none: { kind: window.kind } },
        studentId: { not: null },
        teacherId: { not: null },
      },
      select: {
        id: true,
        scheduledAt: true,
        studentId: true,
        teacherId: true,
        substituteTeacherId: true,
        teacher: { select: { fullName: true } },
        substitute: { select: { fullName: true } },
        student: { select: { fullName: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 200,
    });

    let sent = 0;
    for (const session of sessions) {
      if (!session.studentId) continue;

      // BR-09: pengingat ditujukan ke murid + orang tua, dan guru ikut tahu.
      const audience = [
        ...(await getStudentAudienceIds(session.studentId)),
        ...(session.teacherId ? [session.teacherId] : []),
        ...(session.substituteTeacherId ? [session.substituteTeacherId] : []),
      ];

      const pengajar =
        session.substitute?.fullName ?? session.teacher?.fullName ?? "guru";
      const jam = formatJamWIB(session.scheduledAt);

      // Klaim dan kirim dalam satu transaksi: kalau notifikasi gagal,
      // klaimnya ikut batal sehingga pengingat masih bisa menyusul.
      //
      // Klaim memakai createMany + skipDuplicates, bukan create yang melempar
      // P2002. Dua eksekusi cron yang bertumpuk adalah kejadian normal, dan
      // menanganinya lewat exception membuat log produksi penuh baris
      // prisma:error untuk sesuatu yang sebenarnya baik-baik saja.
      const claimed = await prisma.$transaction(async (tx) => {
        const claim = await tx.sessionReminder.createMany({
          data: [{ sessionId: session.id, kind: window.kind }],
          skipDuplicates: true,
        });
        if (claim.count === 0) return false;

        await createNotifications(tx, {
          userIds: audience,
          type: `session_reminder_${window.kind}`,
          title: "Pengingat sesi privat",
          body: `Sesi ${session.student?.fullName ?? "murid"} bersama ${pengajar} mulai pukul ${jam} WIB — ${window.label}.`,
          data: { sessionId: session.id, kind: window.kind },
        });
        return true;
      });

      if (claimed) sent += 1;
      else summary.raced += 1;
    }

    summary.sent[window.kind] = sent;
  }

  return summary;
}
