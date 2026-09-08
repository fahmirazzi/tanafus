import { describe, expect, it } from "vitest";
import { renderReportCardPdf } from "@/lib/report-card-pdf/render";
import type { ReportCardPdfData } from "@/lib/report-card-pdf/data";

const data: ReportCardPdfData = {
  studentName: "Ahmad Fauzi",
  className: "Tahsin 1 - A",
  courseName: "Tahsin Dasar",
  periodName: "Ganjil 2026",
  periodStart: new Date("2026-01-05T00:00:00.000Z"),
  periodEnd: new Date("2026-06-30T00:00:00.000Z"),
  attendancePct: 87.5,
  sessionsHeld: 40,
  sessionsAttended: 35,
  thresholdPct: 75,
  eligible: true,
  finalGrade: 84.25,
  scores: [
    { name: "Makharijul Huruf", averageScore: 86, sessionsScored: 12 },
    { name: "Tajwid", averageScore: 82.5, sessionsScored: 11 },
  ],
  // Aksara Arab dinamis: inilah yang membuat pilihan mesin PDF perlu
  // dibuktikan lewat spike sebelum dikunci (spec B4 §4.6).
  teacherNote: "Alhamdulillah, bacaan سورة البقرة sudah lancar. Target berikutnya سورة آل عمران.",
  publishedAt: new Date("2026-07-01T03:00:00.000Z"),
};

describe("renderReportCardPdf", () => {
  it("menghasilkan berkas PDF yang sah dengan font Arab ter-embed", async () => {
    const buffer = await renderReportCardPdf(data);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // Ini uji yang benar-benar bisa gagal bila font tidak termuat: kalau
    // path-nya salah, berkasnya .woff2 yang diganti nama, atau
    // registerFonts() tidak pernah dipanggil, @react-pdf/renderer/fontkit
    // MELEMPAR ERROR saat renderToBuffer (sudah dibuktikan langsung: font
    // tak terdaftar melempar "Font family not registered", berkas hilang
    // melempar ENOENT, dan TTF rusak/berformat salah melempar RangeError
    // dari fontkit — ketiganya membuat renderReportCardPdf() di atas
    // REJECT, bukan lolos dengan diam-diam). Baris berikut menambah lapis
    // kedua: memverifikasi program font TrueType SUNGGUH ter-embed di
    // dalam PDF (bukan sekadar tidak melempar), sehingga kalau suatu saat
    // fontFamily di document.tsx diubah tapi lupa registrasinya diikutkan,
    // uji ini tetap menangkapnya.
    const text = buffer.toString("latin1");
    expect(text).toContain("FontFile2");

    // Ambang ukuran longgar (bukan 20rb+ seperti dugaan awal — subsetting
    // @react-pdf/renderer hanya menyematkan glyph yang benar-benar dipakai,
    // jadi PDF sah dengan satu font ter-embed berkisar 9-15rb byte untuk
    // dokumen sependek ini). Nilai ini hanya menangkap PDF yang nyaris
    // kosong (mis. render gagal total lalu fallback ke halaman kosong).
    expect(buffer.byteLength).toBeGreaterThan(8_000);
  }, 30_000);

  it("tetap menghasilkan PDF ketika murid belum punya nilai sama sekali, kehadiran dan kelayakan null", async () => {
    const buffer = await renderReportCardPdf({
      ...data,
      attendancePct: null,
      eligible: null,
      scores: [],
      finalGrade: null,
      teacherNote: null,
    });
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // Basmalah selalu dirender dengan fontFamily "Naskh" terlepas dari ada
    // tidaknya catatan guru, jadi font tetap harus ter-embed di sini juga.
    expect(buffer.toString("latin1")).toContain("FontFile2");
  }, 30_000);
});
