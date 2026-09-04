import { InvoiceStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { addDaysToKey } from "@/lib/sessions";
import { formatTanggalWIB } from "@/lib/datetime";

/**
 * Aturan penagihan privat (BR-04): penomoran, jatuh tempo, keterlambatan.
 *
 * Sama seperti billing.ts, berkas ini sengaja tidak menyentuh database.
 * Tanggal diwakili "kunci tanggal" YYYY-MM-DD dalam kalender lembaga (WIB),
 * bukan objek Date, karena jatuh tempo adalah urusan tanggal kalender —
 * invoice yang jatuh tempo 10 September tidak berubah maknanya oleh jam.
 */

/** BR-04.5: jatuh tempo default H+7 sejak invoice terbit. */
export const INVOICE_DUE_DAYS = 7;

/** BR-04.6: lewat 14 hari sejak jatuh tempo, murid disuspend. */
export const SUSPENSION_AFTER_OVERDUE_DAYS = 14;

/**
 * INV-202609-000123.
 *
 * Bagian bulan diambil dari tanggal terbit sehingga nomor bisa dibaca
 * manusia, tetapi keunikannya bersandar sepenuhnya pada `seq` yang datang
 * dari sequence Postgres — bukan dari hitungan invoice bulan itu, yang akan
 * bertabrakan saat cron menerbitkan banyak invoice sekaligus.
 */
export function formatInvoiceNumber(issueDateKey: string, seq: number | bigint): string {
  const yearMonth = issueDateKey.slice(0, 7).replace("-", "");
  return `INV-${yearMonth}-${String(seq).padStart(6, "0")}`;
}

/** Jatuh tempo sebuah invoice yang terbit pada tanggal tersebut. */
export function dueDateKeyFor(issueDateKey: string): string {
  return addDaysToKey(issueDateKey, INVOICE_DUE_DAYS);
}

/** Selisih hari sejak jatuh tempo; negatif berarti belum jatuh tempo. */
export function daysPastDue(dueDateKey: string, todayKey: string): number {
  const due = Date.parse(`${dueDateKey}T00:00:00.000Z`);
  const today = Date.parse(`${todayKey}T00:00:00.000Z`);
  return Math.round((today - due) / 86_400_000);
}

/**
 * Invoice baru overdue setelah harinya benar-benar terlewat. Pada hari
 * jatuh tempo murid masih punya waktu sampai tengah malam, jadi selisih 0
 * belum menjadikannya terlambat.
 */
export function isPastDue(dueDateKey: string, todayKey: string): boolean {
  return daysPastDue(dueDateKey, todayKey) > 0;
}

/** BR-04.6: suspensi hanya setelah LEBIH dari 14 hari, jadi hari ke-15. */
export function shouldSuspend(dueDateKey: string, todayKey: string): boolean {
  return daysPastDue(dueDateKey, todayKey) > SUSPENSION_AFTER_OVERDUE_DAYS;
}

/** "Sesi Privat 12 Februari 2025, 60 menit" — rincian per sesi di invoice. */
export function sessionItemDescription(
  scheduledAt: Date,
  durationMinutes: number,
): string {
  return `Sesi Privat ${formatTanggalWIB(scheduledAt)}, ${durationMinutes} menit`;
}

/**
 * Status yang masih menunggu uang masuk. `draft` tidak termasuk: invoice
 * privat lahir langsung `issued`, dan draft dicadangkan untuk kelas reguler
 * di fase berikutnya.
 */
export const PAYABLE_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.issued,
  InvoiceStatus.partial,
  InvoiceStatus.overdue,
];

export function isPayable(status: InvoiceStatus): boolean {
  return PAYABLE_INVOICE_STATUSES.includes(status);
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  [InvoiceStatus.draft]: "Draf",
  [InvoiceStatus.issued]: "Menunggu pembayaran",
  [InvoiceStatus.partial]: "Dibayar sebagian",
  [InvoiceStatus.paid]: "Lunas",
  [InvoiceStatus.overdue]: "Terlambat",
  [InvoiceStatus.void]: "Dibatalkan",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  [PaymentStatus.pending]: "Menunggu verifikasi",
  [PaymentStatus.verified]: "Sah",
  [PaymentStatus.rejected]: "Ditolak",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  [PaymentMethod.transfer]: "Transfer bank",
  [PaymentMethod.payment_gateway]: "Midtrans",
  [PaymentMethod.cash]: "Tunai",
  [PaymentMethod.qris]: "QRIS",
};

/**
 * Status invoice setelah pembayaran yang sah dijumlahkan ulang.
 *
 * Dihitung dari total pembayaran terverifikasi, bukan dengan menambah satu
 * pembayaran ke status sebelumnya, sehingga aman dipanggil berkali-kali:
 * webhook Midtrans yang dikirim ulang menghasilkan status yang sama persis.
 *
 * Kelebihan bayar tetap dianggap lunas — selisihnya urusan admin dengan
 * murid, bukan alasan menahan invoice tetap terbuka.
 */
export function statusAfterPayments(params: {
  total: number;
  verifiedTotal: number;
  current: InvoiceStatus;
}): InvoiceStatus {
  if (params.current === InvoiceStatus.void) return InvoiceStatus.void;
  if (params.verifiedTotal >= params.total) return InvoiceStatus.paid;
  if (params.verifiedTotal > 0) return InvoiceStatus.partial;

  // Tanpa pembayaran sah, invoice kembali ke keadaan menagih. Sebuah
  // pembayaran yang dibatalkan admin tidak boleh meninggalkan status "lunas".
  return params.current === InvoiceStatus.overdue
    ? InvoiceStatus.overdue
    : InvoiceStatus.issued;
}

/**
 * Kolom invoice untuk daftar — dipakai API dan halaman tagihan.
 *
 * Sengaja tidak memuat apa pun tentang guru atau upah: BR-10.3 melarang data
 * keuangan pihak lain muncul di layar murid.
 */
export const INVOICE_LIST_SELECT = {
  id: true,
  invoiceNumber: true,
  studentId: true,
  issueDate: true,
  dueDate: true,
  total: true,
  status: true,
  paidAt: true,
  student: { select: { fullName: true } },
  _count: { select: { items: true } },
} as const;

export const INVOICE_DETAIL_SELECT = {
  id: true,
  invoiceNumber: true,
  studentId: true,
  issueDate: true,
  dueDate: true,
  subtotal: true,
  discount: true,
  total: true,
  status: true,
  paidAt: true,
  voidReason: true,
  voidedAt: true,
  createdAt: true,
  student: { select: { fullName: true, email: true, phone: true } },
  items: {
    select: { id: true, description: true, amount: true },
    orderBy: { description: "asc" },
  },
  payments: {
    select: {
      id: true,
      amount: true,
      method: true,
      status: true,
      reference: true,
      proofUrl: true,
      note: true,
      verifiedAt: true,
      paidAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  },
} as const;

/** Warna badge status — dipakai halaman orang tua maupun admin. */
export const INVOICE_STATUS_VARIANT: Record<
  InvoiceStatus,
  "default" | "secondary" | "destructive"
> = {
  [InvoiceStatus.draft]: "secondary",
  [InvoiceStatus.issued]: "secondary",
  [InvoiceStatus.partial]: "secondary",
  [InvoiceStatus.paid]: "default",
  [InvoiceStatus.overdue]: "destructive",
  [InvoiceStatus.void]: "secondary",
};

export const PAYMENT_STATUS_VARIANT: Record<
  PaymentStatus,
  "default" | "secondary" | "destructive"
> = {
  [PaymentStatus.pending]: "secondary",
  [PaymentStatus.verified]: "default",
  [PaymentStatus.rejected]: "destructive",
};
