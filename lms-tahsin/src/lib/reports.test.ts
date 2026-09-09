import { describe, expect, it } from "vitest";
import {
  attendanceReportFilename,
  attendanceReportToCsv,
  reportCardsReportToCsv,
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

describe("attendanceReportToCsv", () => {
  it("menulis header dan satu baris per murid, persentase apa adanya", () => {
    const csv = attendanceReportToCsv([
      {
        studentName: "Ahmad Fauzi",
        present: 10,
        late: 2,
        excused: 3,
        absent: 1,
        sessionsHeld: 16,
        attendancePct: 75,
      },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Murid,Hadir,Terlambat,Izin,Bolos,Sesi Berlangsung,Kehadiran (%)",
    );
    expect(lines[1]).toBe("Ahmad Fauzi,10,2,3,1,16,75");
  });

  it("persentase null ditulis sebagai sel kosong, bukan nol", () => {
    const csv = attendanceReportToCsv([
      {
        studentName: "Budi",
        present: 0,
        late: 0,
        excused: 0,
        absent: 0,
        sessionsHeld: 0,
        attendancePct: null,
      },
    ]);
    expect(csv.split("\r\n")[1]).toBe("Budi,0,0,0,0,0,");
  });

  it("mengutip nama yang memuat koma", () => {
    const csv = attendanceReportToCsv([
      {
        studentName: "Fulan, S.Pd",
        present: 1,
        late: 0,
        excused: 0,
        absent: 0,
        sessionsHeld: 1,
        attendancePct: 100,
      },
    ]);
    expect(csv.split("\r\n")[1]).toBe('"Fulan, S.Pd",1,0,0,0,1,100');
  });
});

describe("reportCardsReportToCsv", () => {
  it("satu kolom per kriteria, kriteria tanpa nilai jadi sel kosong", () => {
    const csv = reportCardsReportToCsv(
      [
        {
          studentName: "Ahmad",
          scores: [{ name: "Tajwid", averageScore: 82.5 }],
          finalGrade: 82.5,
          attendancePct: 90,
          eligible: true,
          status: "published",
        },
      ],
      ["Makharijul Huruf", "Tajwid"],
    );
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Murid,Makharijul Huruf,Tajwid,Nilai Akhir,Kehadiran (%),Kelayakan,Status Rapor",
    );
    expect(lines[1]).toBe("Ahmad,,82.5,82.5,90,Layak,published");
  });

  it("kelayakan null ditulis sebagai Belum dapat dinilai", () => {
    const csv = reportCardsReportToCsv(
      [
        {
          studentName: "Budi",
          scores: [],
          finalGrade: null,
          attendancePct: null,
          eligible: null,
          status: "draft",
        },
      ],
      ["Tajwid"],
    );
    expect(csv.split("\r\n")[1]).toBe("Budi,,,,Belum dapat dinilai,draft");
  });
});

describe("attendanceReportFilename", () => {
  it("membersihkan nama kelas menjadi potongan nama berkas yang aman", () => {
    expect(attendanceReportFilename("Tahsin 1 - A")).toBe(
      "rekap-kehadiran_Tahsin-1-A.csv",
    );
  });
});
