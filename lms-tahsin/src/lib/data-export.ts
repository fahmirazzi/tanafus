/**
 * Penyusun bundel ekspor data pribadi (NFR-6, hak akses UU PDP).
 *
 * Murni: menerima baris yang SUDAH diambil dari database dan hanya
 * membentuknya. Pengambilan datanya ada di route, supaya bentuk berkas
 * ekspor bisa diuji tanpa database.
 *
 * Bundel dibuat on-demand dan tidak pernah disimpan — Fase 2 sengaja tidak
 * menambah ketergantungan file storage.
 */

export type UserExportInput = {
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    birthDate: Date | null;
    createdAt: Date;
  };
  sessions: Array<{
    id: string;
    scheduledAt: Date;
    durationMinutes: number;
    status: string;
  }>;
  grades: Array<{ sessionId: string; criterionName: string; score: number }>;
  feedbacks: Array<{
    sessionId: string;
    strengths: string | null;
    improvements: string | null;
    nextTarget: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    total: number;
    status: string;
    issueDate: Date;
  }>;
  payments: Array<{
    invoiceId: string;
    amount: number;
    method: string;
    status: string;
  }>;
};

export type UserExportBundle = {
  version: number;
  exportedAt: string;
  profile: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    birthDate: string | null;
    createdAt: string;
  };
  sessions: Array<{
    id: string;
    scheduledAt: string;
    durationMinutes: number;
    status: string;
  }>;
  grades: UserExportInput["grades"];
  feedbacks: UserExportInput["feedbacks"];
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    total: number;
    status: string;
    issueDate: string;
  }>;
  payments: UserExportInput["payments"];
};

export function buildUserExport(input: UserExportInput): UserExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: {
      id: input.user.id,
      fullName: input.user.fullName,
      email: input.user.email,
      phone: input.user.phone,
      birthDate: input.user.birthDate?.toISOString() ?? null,
      createdAt: input.user.createdAt.toISOString(),
    },
    sessions: input.sessions.map((s) => ({
      id: s.id,
      scheduledAt: s.scheduledAt.toISOString(),
      durationMinutes: s.durationMinutes,
      status: s.status,
    })),
    grades: input.grades,
    feedbacks: input.feedbacks,
    invoices: input.invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      total: i.total,
      status: i.status,
      issueDate: i.issueDate.toISOString(),
    })),
    payments: input.payments,
  };
}
