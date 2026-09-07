import { writeAudit } from "@/lib/audit";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalWIB } from "@/lib/datetime";
import { formatInvoiceNumber, periodeItemDescription } from "@/lib/invoices";
import type { IssuedInvoice } from "@/lib/invoice-issuer";
import {
  createNotifications,
  getStudentAudienceIds,
} from "@/lib/notifications";
import { zonedDateKey } from "@/lib/sessions";
import { ChargeStatus, InvoiceStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** Tanggal kalender WIB sebagai nilai kolom @db.Date. */
function dateOnly(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

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

/**
 * Terbitkan satu invoice atas SATU charge periode (spec B3 §3.3) — bukan
 * digabung seperti bundel bulanan privat, karena admin sudah mengontrol
 * kapan menerbitkan (tombol "Terbitkan tagihan"), jadi tidak ada alasan
 * menunggu untuk mengakumulasi.
 *
 * Fungsi baru, TIDAK memakai ulang issueInvoice() privat di
 * invoice-issuer.ts — itu 100% khusus SessionCharge, dan menyentuhnya
 * berisiko ke jalur billing privat yang hidup (retro B1 menandai ini
 * sebagai risiko bernama).
 *
 * Mengembalikan null bila charge tidak ditemukan, bukan pending, atau
 * sudah ter-invoice — kondisi wajar untuk dilewati dengan tenang saat
 * dipanggil dari sapuan bulk.
 */
export async function issueEnrollmentChargeInvoice(
  tx: Tx,
  params: { chargeId: string; actorId: string; now: Date },
): Promise<IssuedInvoice | null> {
  const charge = await tx.enrollmentCharge.findUnique({
    where: { id: params.chargeId },
    select: {
      id: true,
      enrollmentId: true,
      installmentNo: true,
      amount: true,
      dueDate: true,
      status: true,
      invoiceItems: { select: { id: true } },
      enrollment: {
        select: {
          studentId: true,
          classGroup: {
            select: { id: true, name: true, periodId: true },
          },
        },
      },
    },
  });
  if (!charge) return null;
  if (charge.status !== ChargeStatus.pending) return null;
  if (charge.invoiceItems.length > 0) return null;

  // Semua cicilan MILIK ENROLLMENT INI, terlepas statusnya sekarang — supaya
  // "Cicilan 1/3" tetap akurat setelah cicilan 1 sudah invoiced.
  const totalInstallments = await tx.enrollmentCharge.count({
    where: { enrollmentId: charge.enrollmentId },
  });

  const description = periodeItemDescription(
    charge.enrollment.classGroup.name,
    charge.installmentNo,
    totalInstallments,
  );
  const amount = Number(charge.amount);

  const issueKey = zonedDateKey(params.now);
  const seq = await nextInvoiceSequence(tx);

  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber: formatInvoiceNumber(issueKey, seq),
      studentId: charge.enrollment.studentId,
      periodId: charge.enrollment.classGroup.periodId,
      issueDate: dateOnly(issueKey),
      // Jatuh tempo cicilan sudah ditentukan admin saat konversi (atau H+7
      // default saat enrollment) — dipakai apa adanya, bukan dihitung ulang
      // H+7 dari hari penerbitan dokumen.
      dueDate: charge.dueDate,
      subtotal: amount,
      total: amount,
      status: InvoiceStatus.issued,
      items: {
        create: [
          {
            enrollmentChargeId: charge.id,
            description,
            amount: charge.amount,
          },
        ],
      },
    },
    select: { id: true, invoiceNumber: true, dueDate: true },
  });

  await tx.enrollmentCharge.update({
    where: { id: charge.id },
    data: { status: ChargeStatus.invoiced },
  });

  await writeAudit(tx, {
    actorId: params.actorId,
    entity: "Invoice",
    entityId: invoice.id,
    action: "issue",
    newData: {
      invoiceNumber: invoice.invoiceNumber,
      studentId: charge.enrollment.studentId,
      total: amount,
      itemCount: 1,
    },
  });

  const audience = await getStudentAudienceIds(charge.enrollment.studentId, tx);
  await createNotifications(tx, {
    userIds: audience,
    type: "invoice_issued",
    title: `Tagihan ${invoice.invoiceNumber}`,
    body: `${description}, total ${formatRupiah(amount)}. Jatuh tempo ${formatTanggalWIB(invoice.dueDate)}.`,
    data: { invoiceId: invoice.id },
  });

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    studentId: charge.enrollment.studentId,
    dueDate: invoice.dueDate,
    total: amount,
    itemCount: 1,
  };
}
