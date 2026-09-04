import { prisma } from "@/lib/prisma";
import { TeacherRequestStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { ReviewRequest } from "@/components/teacher-requests/request-review-list";
import {
  DAY_KEYS,
  DAY_LABEL,
  type DayKey,
} from "@/lib/validations/teacher-request";

/**
 * Kolom preferredTimes bertipe Json bebas, jadi isinya harus diperiksa
 * sebelum dipakai — bisa saja berasal dari data lama atau tulisan manual.
 */
export function parsePreferredTimes(
  value: unknown,
): { day: DayKey; label: string; ranges: string[] }[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;

  return DAY_KEYS.flatMap((day) => {
    const raw = record[day];
    if (!Array.isArray(raw)) return [];
    const ranges = raw.filter((r): r is string => typeof r === "string");
    if (ranges.length === 0) return [];
    return [{ day, label: DAY_LABEL[day], ranges }];
  });
}

/** "Senin 15:00-17:00 · Rabu 16:00-18:00" */
export function formatPreferredTimes(value: unknown): string {
  const parsed = parsePreferredTimes(value);
  if (parsed.length === 0) return "Tidak ada preferensi waktu";
  return parsed
    .map((entry) => `${entry.label} ${entry.ranges.join(", ")}`)
    .join(" · ");
}

// --- pemuatan data untuk halaman review (server-only) ---

const REVIEW_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  teacherId: true,
  preferredDurations: true,
  preferredTimes: true,
  note: true,
  rejectReason: true,
  student: { select: { fullName: true } },
  teacher: { select: { fullName: true } },
  assignment: { select: { level: true } },
} satisfies Prisma.TeacherRequestSelect;

type ReviewRow = Prisma.TeacherRequestGetPayload<{
  select: typeof REVIEW_SELECT;
}>;

function toReviewRequest(row: ReviewRow): ReviewRequest {
  return {
    id: row.id,
    status: row.status,
    // Date tidak bisa menyeberang ke client component apa adanya.
    createdAt: row.createdAt.toISOString(),
    studentName: row.student.fullName,
    teacherId: row.teacherId,
    teacherName: row.teacher?.fullName ?? null,
    preferredDurations: row.preferredDurations,
    preferredTimesLabel: formatPreferredTimes(row.preferredTimes),
    note: row.note,
    rejectReason: row.rejectReason,
    level: row.assignment?.level ?? null,
  };
}

export const OPEN_REQUEST_STATUSES = [
  TeacherRequestStatus.pending,
  TeacherRequestStatus.waitlisted,
];

/**
 * Dipisah jadi dua daftar: yang menunggu keputusan (butuh aksi) dan yang
 * sudah selesai (riwayat). Prisma tidak bisa mengurutkan "status terbuka
 * dulu" dalam satu query, dan dua kartu terpisah juga lebih jelas di UI.
 */
export async function loadReviewRequests(
  where: Prisma.TeacherRequestWhereInput,
  historyLimit = 20,
): Promise<{ open: ReviewRequest[]; decided: ReviewRequest[] }> {
  const [open, decided] = await Promise.all([
    prisma.teacherRequest.findMany({
      where: { ...where, status: { in: OPEN_REQUEST_STATUSES } },
      select: REVIEW_SELECT,
      orderBy: { createdAt: "asc" },
    }),
    prisma.teacherRequest.findMany({
      where: { ...where, status: { notIn: OPEN_REQUEST_STATUSES } },
      select: REVIEW_SELECT,
      orderBy: { createdAt: "desc" },
      take: historyLimit,
    }),
  ]);

  return {
    open: open.map(toReviewRequest),
    decided: decided.map(toReviewRequest),
  };
}
