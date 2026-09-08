/**
 * Kontrak antara route dan renderer PDF. Sengaja data polos: renderer tidak
 * boleh tahu apa pun tentang Prisma, sehingga bisa diuji tanpa database.
 */
export type ReportCardPdfScore = {
  name: string;
  averageScore: number;
  sessionsScored: number;
};

export type ReportCardPdfData = {
  studentName: string;
  className: string;
  courseName: string;
  periodName: string;
  periodStart: Date;
  periodEnd: Date;
  attendancePct: number | null;
  sessionsHeld: number;
  sessionsAttended: number;
  thresholdPct: number;
  eligible: boolean | null;
  finalGrade: number | null;
  scores: ReportCardPdfScore[];
  teacherNote: string | null;
  publishedAt: Date;
};
