import { describe, expect, it } from "vitest";
import {
  attendanceRecap,
  averageByCriterion,
  finalGradeFrom,
  hasBlockers,
  isEligible,
  roundTo2,
  tallyAttendance,
} from "@/lib/report-card";

describe("tallyAttendance", () => {
  it("menghitung tiap status dan mengabaikan status di luar empat itu", () => {
    expect(
      tallyAttendance([
        { status: "present" },
        { status: "present" },
        { status: "late" },
        { status: "excused" },
        { status: "absent" },
        { status: "no_info" },
      ]),
    ).toEqual({ present: 2, late: 1, excused: 1, absent: 1 });
  });

  it("daftar kosong menghasilkan nol semua", () => {
    expect(tallyAttendance([])).toEqual({
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
    });
  });
});

describe("attendanceRecap (BR-02.6a, BR-02.6b)", () => {
  it("izin TETAP di penyebut — 10 hadir dari 40 dengan 30 izin adalah 25%, bukan 100%", () => {
    // Contoh yang ditulis eksplisit di BR-02.6b sebagai alasan aturan ini ada.
    expect(
      attendanceRecap({ present: 10, late: 0, excused: 30, absent: 0 }),
    ).toEqual({ sessionsHeld: 40, sessionsAttended: 10, attendancePct: 25 });
  });

  it("terlambat dihitung hadir", () => {
    expect(
      attendanceRecap({ present: 6, late: 2, excused: 0, absent: 2 }),
    ).toEqual({ sessionsHeld: 10, sessionsAttended: 8, attendancePct: 80 });
  });

  it("penyebut nol menghasilkan null, BUKAN nol persen", () => {
    // 0% berarti murid tidak pernah hadir. "Belum ada sesi" adalah pernyataan
    // yang berbeda, dan rapor tidak boleh menuduh.
    expect(
      attendanceRecap({ present: 0, late: 0, excused: 0, absent: 0 }),
    ).toEqual({ sessionsHeld: 0, sessionsAttended: 0, attendancePct: null });
  });

  it("membulatkan ke dua desimal", () => {
    expect(
      attendanceRecap({ present: 1, late: 0, excused: 0, absent: 2 }).attendancePct,
    ).toBe(33.33);
  });
});

describe("averageByCriterion", () => {
  it("merata-rata per kriteria dan mencatat berapa nilai yang menyumbang", () => {
    expect(
      averageByCriterion([
        { criterionId: 1, score: 80 },
        { criterionId: 1, score: 90 },
        { criterionId: 2, score: 70 },
      ]),
    ).toEqual([
      { criterionId: 1, averageScore: 85, sessionsScored: 2 },
      { criterionId: 2, averageScore: 70, sessionsScored: 1 },
    ]);
  });

  it("terurut menaik menurut criterionId supaya rapor stabil antar terbitan", () => {
    expect(
      averageByCriterion([
        { criterionId: 4, score: 50 },
        { criterionId: 2, score: 60 },
      ]).map((a) => a.criterionId),
    ).toEqual([2, 4]);
  });

  it("tanpa nilai menghasilkan daftar kosong", () => {
    expect(averageByCriterion([])).toEqual([]);
  });
});

describe("finalGradeFrom", () => {
  it("kriteria berbobot sama, berapa pun jumlah nilai yang menyusunnya", () => {
    // Kriteria 1 dinilai 12 kali, kriteria 2 sekali. Keduanya menyumbang sama
    // besar: (90 + 60) / 2 = 75. Kalau dirata-rata dari nilai mentah,
    // hasilnya akan tertarik ke 90 tanpa ada yang pernah memutuskan itu.
    expect(
      finalGradeFrom([
        { criterionId: 1, averageScore: 90, sessionsScored: 12 },
        { criterionId: 2, averageScore: 60, sessionsScored: 1 },
      ]),
    ).toBe(75);
  });

  it("tanpa kriteria bernilai menghasilkan null", () => {
    expect(finalGradeFrom([])).toBeNull();
  });
});

describe("isEligible", () => {
  it("tepat di ambang dinyatakan layak", () => {
    expect(isEligible(75, 75)).toBe(true);
  });

  it("di bawah ambang tidak layak", () => {
    expect(isEligible(74.99, 75)).toBe(false);
  });

  it("kehadiran null berarti kelayakan belum bisa dinyatakan, bukan tidak layak", () => {
    expect(isEligible(null, 75)).toBeNull();
  });
});

describe("roundTo2", () => {
  it("membulatkan setengah ke atas", () => {
    expect(roundTo2(2.005)).toBe(2.01);
    expect(roundTo2(83.333333)).toBe(83.33);
  });

  it("tetap setengah-ke-atas untuk besaran dua digit", () => {
    // Trik `+ Number.EPSILON` yang lama hanya bekerja selagi EPSILON masih
    // signifikan relatif terhadap nilainya: 2.005 kebetulan benar, 5.015
    // jatuh ke 5.01. Nilai seperti ini betul-betul tercapai lewat
    // finalGradeFrom yang merata-ratakan angka yang SUDAH dibulatkan.
    expect(roundTo2(5.015)).toBe(5.02);
    expect(roundTo2(12.345)).toBe(12.35);
    expect(roundTo2(71.005)).toBe(71.01);
    expect(roundTo2(83.335)).toBe(83.34);
  });
});

describe("hasBlockers", () => {
  const kosong = {
    outstandingMakeups: [],
    staleSessions: [],
    studentsWithoutSessions: [],
  };

  it("tanpa penghalang berarti boleh terbit", () => {
    expect(hasBlockers(kosong)).toBe(false);
  });

  it("satu kewajiban make-up terbuka sudah cukup memblokir", () => {
    expect(
      hasBlockers({
        ...kosong,
        outstandingMakeups: [{ sessionId: "s1", scheduledAt: new Date() }],
      }),
    ).toBe(true);
  });

  it("satu sesi basi sudah cukup memblokir", () => {
    expect(
      hasBlockers({
        ...kosong,
        staleSessions: [{ sessionId: "s2", scheduledAt: new Date() }],
      }),
    ).toBe(true);
  });

  it("satu murid tanpa sesi sudah cukup memblokir", () => {
    expect(
      hasBlockers({
        ...kosong,
        studentsWithoutSessions: [{ studentId: "m1", fullName: "Ahmad" }],
      }),
    ).toBe(true);
  });
});
