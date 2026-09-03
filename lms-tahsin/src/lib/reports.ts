import { formatJamWIB, formatTanggalWIB } from "@/lib/datetime";
import { SESSION_STATUS_LABEL } from "@/lib/validations/session";
import { SessionStatus } from "@/generated/prisma/enums";

/**
 * Laporan CSV sesi & pendapatan per periode (roadmap item 28, PRD F-8
 * bagian Dashboard Admin: "Laporan: export CSV sesi/pendapatan per
 * periode").
 *
 * Fungsi di sini murni memformat baris menjadi teks CSV — pemanggil yang
 * membaca dari database. Dipisah begitu supaya pembentukan CSV (escaping,
 * urutan kolom) bisa diuji tanpa Postgres, sejalan dengan pola billing.ts
 * dan invoices.ts.
 */

export type SessionReportRow = {
  scheduledAt: Date;
  durationMinutes: number;
  status: SessionStatus;
  teacherName: string;
  substituteTeacherName: string | null;
  studentName: string;
  /** null = sesi ini tidak pernah ditagih (dibatalkan, belum selesai, dst). */
  chargeAmount: number | null;
  /** null = tidak ada upah untuk sesi ini. */
  earningAmount: number | null;
};

const CSV_HEADER = [
  "Tanggal",
  "Jam",
  "Guru",
  "Guru Pengganti",
  "Murid",
  "Durasi (menit)",
  "Status",
  "Tagihan (Rp)",
  "Upah Guru (Rp)",
];

/**
 * Bungkus nilai untuk satu sel CSV (RFC 4180): dikutip hanya bila memuat
 * koma, kutip, atau baris baru — nama orang Indonesia jarang memerlukannya,
 * tetapi catatan bebas (kalau suatu saat ditambah) bisa saja memuatnya.
 */
function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * CSV lengkap dengan baris header, dipisah CRLF (RFC 4180 dan yang dibaca
 * Excel tanpa syak). Nominal ditulis sebagai angka polos tanpa "Rp" atau
 * pemisah ribuan, supaya spreadsheet mengenalinya sebagai angka yang bisa
 * dijumlahkan, bukan teks.
 */
export function sessionsReportToCsv(rows: readonly SessionReportRow[]): string {
  const lines = [CSV_HEADER.map(csvCell).join(",")];

  for (const row of rows) {
    lines.push(
      [
        csvCell(formatTanggalWIB(row.scheduledAt)),
        csvCell(formatJamWIB(row.scheduledAt)),
        csvCell(row.teacherName),
        csvCell(row.substituteTeacherName ?? ""),
        csvCell(row.studentName),
        String(row.durationMinutes),
        csvCell(SESSION_STATUS_LABEL[row.status]),
        row.chargeAmount !== null ? String(row.chargeAmount) : "",
        row.earningAmount !== null ? String(row.earningAmount) : "",
      ].join(","),
    );
  }

  return lines.join("\r\n");
}

/** Nama berkas unduhan: laporan-sesi_2026-09-01_2026-09-30.csv */
export function sessionsReportFilename(fromKey: string, toKey: string): string {
  return `laporan-sesi_${fromKey}_${toKey}.csv`;
}

export type RevenueTotals = {
  sessionCount: number;
  billableCount: number;
  totalCharge: number;
  totalEarning: number;
};

/** Ringkasan cepat untuk ditampilkan di layar sebelum orang mengunduh CSV-nya. */
export function summarizeRevenue(
  rows: readonly Pick<SessionReportRow, "chargeAmount" | "earningAmount">[],
): RevenueTotals {
  let billableCount = 0;
  let totalCharge = 0;
  let totalEarning = 0;

  for (const row of rows) {
    if (row.chargeAmount !== null) {
      billableCount += 1;
      totalCharge += row.chargeAmount;
    }
    if (row.earningAmount !== null) {
      totalEarning += row.earningAmount;
    }
  }

  return {
    sessionCount: rows.length,
    billableCount,
    totalCharge,
    totalEarning,
  };
}
