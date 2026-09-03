import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalWIB } from "@/lib/datetime";
import {
  dueDateKeyFor,
  formatInvoiceNumber,
  sessionItemDescription,
} from "@/lib/invoices";
import {
  createNotifications,
  getStudentAudienceIds,
} from "@/lib/notifications";
import { zonedDateKey, zonedDateTimeToUtc } from "@/lib/sessions";
import { ChargeStatus, InvoiceStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Penerbitan invoice privat (roadmap item 21, PRD F-5b & F-5c).
 *
 * Dua mode BR-04.3 memakai jalan yang sama: kumpulkan charge yang belum
 * ter-invoice, lalu terbitkan satu invoice berisi charge-charge itu. Yang
 * membedakan hanyalah kapan dipanggil — per_session dipanggil saat guru
 * menutup sesi, monthly_bundle dipanggil cron tanggal 1.
 */

type Tx = Prisma.TransactionClient;

/** Tanggal kalender WIB sebagai nilai kolom @db.Date. */
function dateOnly(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/**
 * Nomor urut berikutnya dari sequence Postgres.
 *
 * Sengaja tidak menghitung invoice yang sudah ada: dua transaksi yang
 * berjalan bersamaan akan membaca hitungan yang sama dan menabrakkan
 * unique invoiceNumber. nextval kebal terhadap itu tanpa mengunci baris.
 */
async function nextInvoiceSequence(tx: Tx): Promise<bigint> {
  const rows = await tx.$queryRaw<
    { nextval: bigint }[]
  >`SELECT nextval('invoice_number_seq')`;
  const value = rows[0]?.nextval;
  if (value === undefined) {
    throw new Error("Sequence nomor invoice tidak mengembalikan nilai");
  }
  return value;
}

export type IssuedInvoice = {
  id: string;
  invoiceNumber: string;
  total: number;
  itemCount: number;
};

/**
 * Terbitkan satu invoice atas charge milik seorang murid.
 *
 * Mengembalikan null bila tidak ada charge yang layak — kondisi yang wajar,
 * bukan kesalahan: cron yang berjalan dua kali, atau sesi yang chargenya
 * sudah masuk invoice sebelumnya, keduanya berakhir di sini dengan tenang.
 *
 * Idempotensi bersandar pada dua hal yang saling menutupi: filter
 * `invoiceItems: { none: {} }` menyaring charge yang sudah ditagih, dan
 * unique sessionChargeId di InvoiceItem menggagalkan transaksi seandainya
 * dua proses lolos filter itu pada saat yang sama.
 */
export async function issueInvoice(
  tx: Tx,
  params: {
    studentId: string;
    chargeIds?: readonly string[];
    /** Batas atas createdAt charge yang ikut ditagih (dipakai bundel bulanan). */
    chargesBefore?: Date;
    actorId: string;
    now: Date;
  },
): Promise<IssuedInvoice | null> {
  const charges = await tx.sessionCharge.findMany({
    where: {
      studentId: params.studentId,
      status: ChargeStatus.pending,
      invoiceItems: { none: {} },
      ...(params.chargeIds ? { id: { in: [...params.chargeIds] } } : {}),
      ...(params.chargesBefore ? { createdAt: { lt: params.chargesBefore } } : {}),
    },
    select: {
      id: true,
      amount: true,
      durationMinutes: true,
      session: { select: { scheduledAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (charges.length === 0) return null;

  const items = charges.map((charge) => ({
    sessionChargeId: charge.id,
    description: sessionItemDescription(
      charge.session.scheduledAt,
      charge.durationMinutes,
    ),
    amount: charge.amount,
  }));

  const subtotal = charges.reduce(
    (sum, charge) => sum + Number(charge.amount),
    0,
  );

  const issueKey = zonedDateKey(params.now);
  const seq = await nextInvoiceSequence(tx);

  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber: formatInvoiceNumber(issueKey, seq),
      studentId: params.studentId,
      issueDate: dateOnly(issueKey),
      dueDate: dateOnly(dueDateKeyFor(issueKey)),
      subtotal,
      total: subtotal,
      // BR-04.5: invoice privat lahir langsung tertagih, tidak lewat draf.
      status: InvoiceStatus.issued,
      items: { create: items },
    },
    select: { id: true, invoiceNumber: true, dueDate: true },
  });

  await tx.sessionCharge.updateMany({
    where: { id: { in: charges.map((c) => c.id) } },
    data: { status: ChargeStatus.invoiced },
  });

  await writeAudit(tx, {
    actorId: params.actorId,
    entity: "Invoice",
    entityId: invoice.id,
    action: "issue",
    newData: {
      invoiceNumber: invoice.invoiceNumber,
      studentId: params.studentId,
      total: subtotal,
      itemCount: items.length,
    },
  });

  // BR-09: invoice terbit wajib diberitahukan ke murid dan orang tuanya.
  const audience = await getStudentAudienceIds(params.studentId, tx);
  await createNotifications(tx, {
    userIds: audience,
    type: "invoice_issued",
    title: `Tagihan ${invoice.invoiceNumber}`,
    body: `${items.length} sesi, total ${formatRupiah(subtotal)}. Jatuh tempo ${formatTanggalWIB(invoice.dueDate)}.`,
    data: { invoiceId: invoice.id },
  });

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    total: subtotal,
    itemCount: items.length,
  };
}

// ------------------------------------------------------- bundel bulanan

export type BundleSummary = {
  /** Batas atas charge yang ikut ditagih, dalam kalender WIB. */
  cutoffDate: string;
  studentsConsidered: number;
  invoicesCreated: number;
  totalAmount: number;
  failures: number;
};

/**
 * Cron tanggal 1: satu invoice per murid berisi seluruh charge bulan lalu
 * (BR-04.3b), sekaligus penyapu charge yang tertinggal.
 *
 * Batasnya adalah awal bulan berjalan, bukan "bulan lalu" secara harfiah.
 * Bedanya terasa ketika sebuah jalan cron terlewat: dengan batas awal bulan,
 * charge dua bulan lalu yang tertinggal ikut tertagih pada jalan berikutnya
 * alih-alih menggantung selamanya.
 *
 * Murid per_session sengaja ikut disapu, meski BR-04.3a menagihnya seketika
 * saat sesi ditutup. Ada satu jalan yang meninggalkan charge menggantung:
 * invoice yang di-void mengembalikan charge-nya ke `pending`, dan bagi murid
 * per_session tidak ada peristiwa berikutnya yang akan menagihnya lagi —
 * sesinya sudah lama ditutup. Membatasi sapuan ini hanya pada murid bundel
 * berarti sesi yang benar-benar terjadi diam-diam hilang dari tagihan.
 * Batas "lebih tua dari bulan berjalan" menjaga jalur normal per_session
 * tidak tersentuh: charge bulan ini sudah punya invoicenya sendiri.
 *
 * Tiap murid diproses dalam transaksinya sendiri supaya satu murid yang
 * bermasalah tidak membatalkan tagihan murid lain.
 */
export async function runMonthlyBundle(
  options: { now?: Date; actorId?: string } = {},
): Promise<BundleSummary> {
  const now = options.now ?? new Date();
  const actorId = options.actorId ?? "system";

  const cutoffKey = `${zonedDateKey(now).slice(0, 7)}-01`;
  const cutoff = zonedDateTimeToUtc(cutoffKey, "00:00");

  const students = await prisma.user.findMany({
    where: {
      charges: {
        some: {
          status: ChargeStatus.pending,
          invoiceItems: { none: {} },
          createdAt: { lt: cutoff },
        },
      },
    },
    select: { id: true },
  });

  const summary: BundleSummary = {
    cutoffDate: cutoffKey,
    studentsConsidered: students.length,
    invoicesCreated: 0,
    totalAmount: 0,
    failures: 0,
  };

  for (const student of students) {
    try {
      const issued = await prisma.$transaction(
        (tx) =>
          issueInvoice(tx, {
            studentId: student.id,
            chargesBefore: cutoff,
            actorId,
            now,
          }),
        TX_OPTIONS,
      );
      if (issued) {
        summary.invoicesCreated += 1;
        summary.totalAmount += issued.total;
      }
    } catch (error) {
      summary.failures += 1;
      console.error(
        JSON.stringify({
          level: "error",
          msg: "monthly_bundle_failed",
          studentId: student.id,
          error: String(error),
        }),
      );
    }
  }

  return summary;
}
