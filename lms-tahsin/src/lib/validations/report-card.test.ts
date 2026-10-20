import { describe, expect, it } from "vitest";
import {
  cohortGradesSchema,
  publishedReportCardNoteSchema,
  reportCardPatchSchema,
} from "@/lib/validations/report-card";

describe("reportCardPatchSchema", () => {
  it("meloloskan finalGradeOverride: null sebagai null sungguhan (menghapus timpaan)", () => {
    // z.coerce.number() lama mengubah null menjadi 0 sebelum cabang
    // z.null() sempat dicoba — ini bug yang sedang diperbaiki.
    const parsed = reportCardPatchSchema.safeParse({ finalGradeOverride: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.finalGradeOverride).toBeNull();
    }
  });

  it("menolak finalGradeOverride: 90 tanpa alasan", () => {
    const parsed = reportCardPatchSchema.safeParse({ finalGradeOverride: 90 });
    expect(parsed.success).toBe(false);
  });

  it("meloloskan finalGradeOverride: 90 dengan alasan", () => {
    const parsed = reportCardPatchSchema.safeParse({
      finalGradeOverride: 90,
      overrideReason: "x",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.finalGradeOverride).toBe(90);
    }
  });

  it("meloloskan teacherNote saja dan finalGradeOverride tetap undefined (PATCH parsial)", () => {
    const parsed = reportCardPatchSchema.safeParse({ teacherNote: "x" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // Bukan null, bukan 0 — field yang tidak dikirim harus tetap tidak
      // tersentuh, karena PATCH bergantung pada perbedaan undefined vs null.
      expect(parsed.data.finalGradeOverride).toBeUndefined();
    }
  });
});

describe("publishedReportCardNoteSchema", () => {
  it("meloloskan perbaikan catatan guru", () => {
    const parsed = publishedReportCardNoteSchema.safeParse({
      teacherNote: "Bacaan sudah lancar.",
    });
    expect(parsed.success).toBe(true);
  });

  it("meloloskan string kosong (menghapus catatan yang keliru)", () => {
    const parsed = publishedReportCardNoteSchema.safeParse({ teacherNote: "" });
    expect(parsed.success).toBe(true);
  });

  it("menolak finalGradeOverride yang ikut dikirim ke rapor terbit", () => {
    // Inti pelonggarannya: rapor terbit boleh diperbaiki NARASINYA saja.
    // Payload berangka harus DITOLAK, bukan diterima lalu field-nya
    // diabaikan diam-diam — guru yang mengira baru mengubah nilai akhir
    // harus mendengarnya sekarang, bukan menemukannya di PDF yang tak
    // berubah. Karena itu skema ini .strict().
    const parsed = publishedReportCardNoteSchema.safeParse({
      teacherNote: "x",
      finalGradeOverride: 90,
      overrideReason: "revisi",
    });
    expect(parsed.success).toBe(false);
  });

  it("menolak badan tanpa teacherNote sama sekali", () => {
    // Berbeda dari reportCardPatchSchema yang memang parsial: satu-satunya
    // alasan mem-PATCH rapor terbit adalah memperbaiki narasinya.
    const parsed = publishedReportCardNoteSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });
});

describe("cohortGradesSchema", () => {
  it("menolak score: \"\" (sel kosong bukan nol)", () => {
    const parsed = cohortGradesSchema.safeParse({
      grades: [{ studentId: "00000000-0000-0000-0000-000000000000", criterionId: 1, score: "" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("menolak score: null (sel kosong bukan nol)", () => {
    const parsed = cohortGradesSchema.safeParse({
      grades: [{ studentId: "00000000-0000-0000-0000-000000000000", criterionId: 1, score: null }],
    });
    expect(parsed.success).toBe(false);
  });

  it("meloloskan score: 0 sebagai nol yang sah", () => {
    const parsed = cohortGradesSchema.safeParse({
      grades: [{ studentId: "00000000-0000-0000-0000-000000000000", criterionId: 1, score: 0 }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.grades[0].score).toBe(0);
    }
  });
});
