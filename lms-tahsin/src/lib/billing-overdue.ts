import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalWIB } from "@/lib/datetime";
import {
  SUSPENSION_AFTER_OVERDUE_DAYS,
  daysPastDue,
} from "@/lib/invoices";
import {
  createNotifications,
  getStudentAudienceIds,
  sendEventEmail,
} from "@/lib/notifications";
import { addDaysToKey, zonedDateKey } from "@/lib/sessions";
import { InvoiceStatus } from "@/generated/prisma/enums";

/**
 * Cron harian keterlambatan bayar (roadmap item 24, PRD F-5e).
 *
 * Dua langkah berurutan dan sengaja tidak digabung: tandai dulu invoice yang
 * lewat jatuh tempo, baru periksa siapa yang sudah lewat 14 hari. Urutan itu
 * membuat langkah kedua cukup membaca status `overdue` saja, dan membuat
 * seluruh pekerjaan aman diulang — menandai overdue invoice yang sudah
 * overdue tidak mengubah apa pun.
 */

/** Tanggal kalender WIB sebagai nilai kolom @db.Date. */
function dateOnly(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** Judul + isi notifikasi "tagihan terlambat" — dipakai untuk baris in-app
 * maupun email, supaya keduanya tidak pernah berbeda kata. */
function overdueNotice(invoice: {
  invoiceNumber: string;
  dueDate: Date;
  total: unknown;
}): { title: string; body: string } {
  const title = `Tagihan ${invoice.invoiceNumber} terlambat`;
  return {
    title,
    body: `Jatuh tempo ${formatTanggalWIB(invoice.dueDate)}, sebesar ${formatRupiah(Number(invoice.total))}. Mohon segera diselesaikan agar sesi tidak terhenti.`,
  };
}

export type OverdueSummary = {
  today: string;
  markedOverdue: number;
  suspended: number;
  failures: number;
};

export async function runOverdueSweep(
  options: { now?: Date; actorId?: string } = {},
): Promise<OverdueSummary> {
  const now = options.now ?? new Date();
  const actorId = options.actorId ?? "system";
  const todayKey = zonedDateKey(now);

  const summary: OverdueSummary = {
    today: todayKey,
    markedOverdue: 0,
    suspended: 0,
    failures: 0,
  };

  // --- 1. Invoice yang hari jatuh temponya sudah benar-benar terlewat.
  //
  // `lt` terhadap tanggal hari ini, bukan `lte`: murid masih punya waktu
  // sampai tengah malam pada hari jatuh tempo (lihat isPastDue).
  const due = await prisma.invoice.findMany({
    where: {
      status: { in: [InvoiceStatus.issued, InvoiceStatus.partial] },
      dueDate: { lt: dateOnly(todayKey) },
    },
    select: {
      id: true,
      invoiceNumber: true,
      studentId: true,
      dueDate: true,
      total: true,
    },
  });

  for (const invoice of due) {
    try {
      // Transaksi mengembalikan audiens hanya bila update-nya benar-benar
      // terjadi (null = sudah ditangani proses lain, lihat komentar di
      // dalam). Dipakai di luar untuk mengirim email SETELAH commit — lihat
      // catatan di sendEventEmail kenapa tidak dari dalam transaksi.
      const audience = await prisma.$transaction(async (tx) => {
        // Status disaring ulang di dalam transaksi: pembayaran bisa saja
        // masuk antara pembacaan daftar dan pemrosesan baris ini, dan
        // invoice yang sudah lunas tidak boleh berubah jadi terlambat.
        const updated = await tx.invoice.updateMany({
          where: {
            id: invoice.id,
            status: { in: [InvoiceStatus.issued, InvoiceStatus.partial] },
          },
          data: { status: InvoiceStatus.overdue },
        });
        if (updated.count === 0) return null;

        await writeAudit(tx, {
          actorId,
          entity: "Invoice",
          entityId: invoice.id,
          action: "status_change",
          oldData: { status: InvoiceStatus.issued },
          newData: { status: InvoiceStatus.overdue },
        });

        const audience = await getStudentAudienceIds(invoice.studentId, tx);
        const notice = overdueNotice(invoice);
        await createNotifications(tx, {
          userIds: audience,
          type: "invoice_overdue",
          title: notice.title,
          body: notice.body,
          data: { invoiceId: invoice.id },
        });

        return audience;
      }, TX_OPTIONS);

      if (audience) {
        summary.markedOverdue += 1;
        const notice = overdueNotice(invoice);
        await sendEventEmail(audience, { subject: notice.title, ...notice });
      }
    } catch (error) {
      summary.failures += 1;
      console.error(
        JSON.stringify({
          level: "error",
          msg: "mark_overdue_failed",
          invoiceId: invoice.id,
          error: String(error),
        }),
      );
    }
  }

  // --- 2. BR-04.6: overdue LEBIH dari 14 hari -> suspensi.
  //
  // Ambangnya diterjemahkan menjadi batas tanggal sekali di sini supaya
  // penyaringan terjadi di database, bukan dengan menarik semua invoice
  // overdue ke memori.
  const suspensionCutoff = addDaysToKey(
    todayKey,
    -(SUSPENSION_AFTER_OVERDUE_DAYS + 1),
  );

  const stale = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.overdue,
      dueDate: { lte: dateOnly(suspensionCutoff) },
      student: { suspendedAt: null },
    },
    select: {
      id: true,
      invoiceNumber: true,
      studentId: true,
      dueDate: true,
    },
    orderBy: { dueDate: "asc" },
  });

  // Satu murid bisa punya beberapa invoice basi; yang tertua yang dicatat
  // sebagai alasan suspensi.
  const seen = new Set<string>();

  for (const invoice of stale) {
    if (seen.has(invoice.studentId)) continue;
    seen.add(invoice.studentId);

    const overdueDays = daysPastDue(zonedDateKey(invoice.dueDate), todayKey);
    const reason = `Tagihan ${invoice.invoiceNumber} terlambat ${overdueDays} hari`;

    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.user.updateMany({
          where: { id: invoice.studentId, suspendedAt: null },
          data: { suspendedAt: now, suspensionReason: reason },
        });
        if (updated.count === 0) return;

        await writeAudit(tx, {
          actorId,
          entity: "User",
          entityId: invoice.studentId,
          action: "suspend",
          newData: { reason, invoiceId: invoice.id },
        });

        const audience = await getStudentAudienceIds(invoice.studentId, tx);
        await createNotifications(tx, {
          userIds: audience,
          type: "student_suspended",
          title: "Penjadwalan sesi dihentikan sementara",
          body: `${reason}. Sesi yang sudah terjadwal tetap berjalan, tetapi sesi baru belum bisa dibuat sampai tagihan lunas. Selesaikan pembayaran, lalu hubungi admin untuk mengaktifkan kembali.`,
          data: { invoiceId: invoice.id },
        });

        summary.suspended += 1;
      }, TX_OPTIONS);
    } catch (error) {
      summary.failures += 1;
      console.error(
        JSON.stringify({
          level: "error",
          msg: "suspend_student_failed",
          studentId: invoice.studentId,
          error: String(error),
        }),
      );
    }
  }

  return summary;
}
