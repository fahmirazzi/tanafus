import { describe, expect, it } from "vitest";
import {
  sessionsReportFilename,
  sessionsReportToCsv,
  summarizeRevenue,
  type SessionReportRow,
} from "@/lib/reports";
import { SessionStatus } from "@/generated/prisma/enums";

function row(overrides: Partial<SessionReportRow> = {}): SessionReportRow {
  return {
    scheduledAt: new Date("2026-09-03T09:00:00.000Z"), // 16.00 WIB
    durationMinutes: 60,
    status: SessionStatus.completed,
    teacherName: "Ustadz Abdurrahman",
    substituteTeacherName: null,
    studentName: "Fatimah Hasan",
    chargeAmount: 90000,
    earningAmount: 54000,
    ...overrides,
  };
}

describe("sessionsReportToCsv", () => {
  it("menulis baris header dalam bahasa Indonesia", () => {
    const csv = sessionsReportToCsv([]);
    expect(csv).toBe(
      "Tanggal,Jam,Guru,Guru Pengganti,Murid,Durasi (menit),Status,Tagihan (Rp),Upah Guru (Rp)",
    );
  });

  it("menulis satu baris sesi lengkap dengan tagihan dan upah", () => {
    const csv = sessionsReportToCsv([row()]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      "3 September 2026,16.00,Ustadz Abdurrahman,,Fatimah Hasan,60,Selesai,90000,54000",
    );
  });

  it("mengosongkan kolom tagihan dan upah untuk sesi yang tidak pernah ditagih", () => {
    const csv = sessionsReportToCsv([
      row({
        status: SessionStatus.cancelled_teacher,
        chargeAmount: null,
        earningAmount: null,
      }),
    ]);
    const [, line] = csv.split("\r\n");
    expect(line.endsWith(",Dibatalkan guru,,")).toBe(true);
  });

  it("menyertakan nama guru pengganti ketika ada (BR-04.4)", () => {
    const csv = sessionsReportToCsv([
      row({ substituteTeacherName: "Ustadzah Khadijah" }),
    ]);
    const [, line] = csv.split("\r\n");
    expect(line).toContain(",Ustadzah Khadijah,");
  });

  it("mengutip sel yang memuat koma, sesuai RFC 4180", () => {
    const csv = sessionsReportToCsv([row({ studentName: "Hasan, Fatimah" })]);
    const [, line] = csv.split("\r\n");
    expect(line).toContain('"Hasan, Fatimah"');
  });

  it("meng-escape tanda kutip ganda dengan menggandakannya", () => {
    const csv = sessionsReportToCsv([
      row({ teacherName: 'Ustadz "Abu" Rahman' }),
    ]);
    const [, line] = csv.split("\r\n");
    expect(line).toContain('"Ustadz ""Abu"" Rahman"');
  });

  it("baris CRLF, bukan LF — Excel di Windows mensyaratkan ini", () => {
    const csv = sessionsReportToCsv([row(), row()]);
    expect(csv.includes("\r\n")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});

describe("sessionsReportFilename", () => {
  it("menyisipkan rentang tanggal ke nama berkas", () => {
    expect(sessionsReportFilename("2026-09-01", "2026-09-30")).toBe(
      "laporan-sesi_2026-09-01_2026-09-30.csv",
    );
  });
});

describe("summarizeRevenue", () => {
  it("menjumlahkan tagihan dan upah hanya dari sesi yang billable", () => {
    const totals = summarizeRevenue([
      row(),
      row({
        status: SessionStatus.cancelled_teacher,
        chargeAmount: null,
        earningAmount: null,
      }),
    ]);
    expect(totals).toEqual({
      sessionCount: 2,
      billableCount: 1,
      totalCharge: 90000,
      totalEarning: 54000,
    });
  });

  it("nol untuk daftar kosong", () => {
    expect(summarizeRevenue([])).toEqual({
      sessionCount: 0,
      billableCount: 0,
      totalCharge: 0,
      totalEarning: 0,
    });
  });
});
