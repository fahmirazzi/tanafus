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

export type AttendanceReportRow = {
  studentName: string;
  present: number;
  late: number;
  excused: number;
  absent: number;
  sessionsHeld: number;
  attendancePct: number | null;
};

const ATTENDANCE_HEADER = [
  "Murid",
  "Hadir",
  "Terlambat",
  "Izin",
  "Bolos",
  "Sesi Berlangsung",
  "Kehadiran (%)",
];

/**
 * Rekap kehadiran satu class group (spec B4 §4.7).
 *
 * Persentase null ditulis sebagai sel KOSONG, bukan 0: sel kosong berarti
 * "belum ada sesi", sedangkan 0 adalah pernyataan bahwa murid tidak pernah
 * hadir — dan spreadsheet akan menjumlahkan yang kedua.
 */
export function attendanceReportToCsv(
  rows: readonly AttendanceReportRow[],
): string {
  const lines = [ATTENDANCE_HEADER.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.studentName),
        String(row.present),
        String(row.late),
        String(row.excused),
        String(row.absent),
        String(row.sessionsHeld),
        row.attendancePct !== null ? String(row.attendancePct) : "",
      ].join(","),
    );
  }
  return lines.join("\r\n");
}

export type ReportCardReportRow = {
  studentName: string;
  scores: Array<{ name: string; averageScore: number }>;
  finalGrade: number | null;
  attendancePct: number | null;
  eligible: boolean | null;
  status: string;
};

/** Satu kolom per kriteria, urutannya ditentukan pemanggil supaya stabil. */
export function reportCardsReportToCsv(
  rows: readonly ReportCardReportRow[],
  criterionNames: readonly string[],
): string {
  const header = [
    "Murid",
    ...criterionNames,
    "Nilai Akhir",
    "Kehadiran (%)",
    "Kelayakan",
    "Status Rapor",
  ];
  const lines = [header.map(csvCell).join(",")];

  for (const row of rows) {
    const byName = new Map(row.scores.map((s) => [s.name, s.averageScore]));
    lines.push(
      [
        csvCell(row.studentName),
        ...criterionNames.map((name) => {
          const value = byName.get(name);
          return value === undefined ? "" : String(value);
        }),
        row.finalGrade !== null ? String(row.finalGrade) : "",
        row.attendancePct !== null ? String(row.attendancePct) : "",
        csvCell(
          row.eligible === null
            ? "Belum dapat dinilai"
            : row.eligible
              ? "Layak"
              : "Belum layak",
        ),
        csvCell(row.status),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}

/**
 * Ubah nama kelas menjadi potongan nama berkas yang aman.
 *
 * Runtun spasi ATAU tanda hubung diciutkan jadi satu tanda hubung — bukan
 * hanya spasi. Brief awal memakai `\s+` saja, yang pada masukan seperti
 * "Tahsin 1 - A" menyisakan tanda hubung asli di antara tanda hubung hasil
 * konversi spasi ("Tahsin-1---A"). Menggabungkan kedua pemisah ke satu kelas
 * karakter itulah yang membuat hasilnya konsisten ("Tahsin-1-A").
 */
function slugForFilename(value: string): string {
  return value
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

export function attendanceReportFilename(className: string): string {
  return `rekap-kehadiran_${slugForFilename(className)}.csv`;
}

export function reportCardsReportFilename(className: string): string {
  return `rapor_${slugForFilename(className)}.csv`;
}
