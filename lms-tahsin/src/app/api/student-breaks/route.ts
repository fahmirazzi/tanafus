import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  hasRole,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import type { SessionUser } from "@/lib/auth-guard";
import { TX_OPTIONS } from "@/lib/users";
import { createNotifications, getAdminUserIds } from "@/lib/notifications";
import { zonedDateKey } from "@/lib/sessions";
import { createStudentBreakSchema } from "@/lib/validations/student-break";
import {
  PrivateAssignmentStatus,
  RoleName,
  SimpleApprovalStatus,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export const BREAK_SELECT = {
  id: true,
  studentId: true,
  teacherId: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  student: { select: { fullName: true } },
  teacher: { select: { fullName: true } },
};

/**
 * Yang boleh MENGAJUKAN libur (docs/02): admin, murid itu sendiri, atau
 * orang tuanya. Guru tidak — libur adalah inisiatif pihak murid, guru yang
 * menyetujui.
 */
async function assertCanRequestBreak(
  user: SessionUser,
  studentId: string,
): Promise<void> {
  if (isAdmin(user)) return;
  if (user.id === studentId && hasRole(user, RoleName.student)) return;

  if (hasRole(user, RoleName.parent)) {
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: user.id, studentId } },
      select: { parentId: true },
    });
    if (link) return;
  }
  throw new ForbiddenError();
}

async function scopeForViewer(
  user: SessionUser,
): Promise<Prisma.StudentBreakWhereInput> {
  if (isAdmin(user)) return {};

  const or: Prisma.StudentBreakWhereInput[] = [];
  if (hasRole(user, RoleName.teacher)) or.push({ teacherId: user.id });
  if (hasRole(user, RoleName.student)) or.push({ studentId: user.id });
  if (hasRole(user, RoleName.parent)) {
    const links = await prisma.parentStudent.findMany({
      where: { parentId: user.id },
      select: { studentId: true },
    });
    if (links.length > 0) {
      or.push({ studentId: { in: links.map((l) => l.studentId) } });
    }
  }

  if (or.length === 0) return { id: { in: [] } };
  return { OR: or };
}

export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const rows = await prisma.studentBreak.findMany({
      where: await scopeForViewer(user),
      select: BREAK_SELECT,
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      take: 100,
    });
    return apiOk(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const body: unknown = await req.json();
    const parsed = createStudentBreakSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { studentId, teacherId, startDate, endDate, reason } = parsed.data;

    await assertCanRequestBreak(user, studentId);

    // Libur diajukan terhadap seorang guru, jadi hubungan itu harus ada.
    const assignment = await prisma.privateAssignment.findUnique({
      where: { teacherId_studentId: { teacherId, studentId } },
      select: { status: true, student: { select: { fullName: true } } },
    });
    if (!assignment || assignment.status === PrivateAssignmentStatus.ended) {
      return apiError("Data tidak valid", 422, {
        teacherId: "Murid ini tidak sedang belajar dengan guru tersebut",
      });
    }

    // Libur yang sudah lewat tidak ada gunanya diajukan.
    if (endDate < zonedDateKey(new Date())) {
      return apiError("Rentang libur sudah lewat", 422);
    }

    // Rentang yang bertumpuk membuat aturan generator ambigu.
    const overlapping = await prisma.studentBreak.findFirst({
      where: {
        studentId,
        teacherId,
        status: {
          in: [SimpleApprovalStatus.pending, SimpleApprovalStatus.approved],
        },
        startDate: { lte: new Date(endDate) },
        endDate: { gte: new Date(startDate) },
      },
      select: { id: true },
    });
    if (overlapping) {
      return apiError(
        "Sudah ada pengajuan libur yang bertumpuk dengan rentang ini",
        422,
      );
    }

    const adminIds = await getAdminUserIds();

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.studentBreak.create({
        data: {
          studentId,
          teacherId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          reason: reason?.trim() ? reason.trim() : null,
        },
        select: { id: true, status: true },
      });

      await createNotifications(tx, {
        userIds: [teacherId, ...adminIds],
        type: "student_break_requested",
        title: "Pengajuan libur murid",
        body: `${assignment.student.fullName} mengajukan libur ${startDate} sampai ${endDate}.`,
        data: { breakId: row.id, studentId },
      });

      return row;
    }, TX_OPTIONS);

    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
