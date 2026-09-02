import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import { TX_OPTIONS } from "@/lib/users";
import {
  createNotifications,
  getStudentAudienceIds,
} from "@/lib/notifications";
import { reviewTeacherRequestSchema } from "@/lib/validations/teacher-request";
import {
  PrivateAssignmentStatus,
  RoleName,
  TeacherRequestStatus,
} from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Review pengajuan murid privat (PRD F-1 langkah 3).
 * Yang berhak: admin, atau guru yang diminta pada pengajuan itu.
 */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = reviewTeacherRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { action, level, rejectReason } = parsed.data;

    const request = await prisma.teacherRequest.findUnique({
      where: { id },
      select: {
        id: true,
        studentId: true,
        teacherId: true,
        status: true,
        student: { select: { fullName: true } },
      },
    });
    if (!request) return apiError("Pengajuan tidak ditemukan", 404);

    const actorIsAdmin = isAdmin(user);
    const actorIsRequestedTeacher =
      request.teacherId !== null && request.teacherId === user.id;
    if (!actorIsAdmin && !actorIsRequestedTeacher) throw new ForbiddenError();

    // approved dan rejected bersifat final; hanya pending/waitlisted yang
    // masih bisa diproses ulang.
    const reviewable: TeacherRequestStatus[] = [
      TeacherRequestStatus.pending,
      TeacherRequestStatus.waitlisted,
    ];
    if (!reviewable.includes(request.status)) {
      return apiError("Pengajuan ini sudah diputuskan", 422);
    }

    const audience = await getStudentAudienceIds(request.studentId);
    const handled = { handledBy: user.id, handledAt: new Date() };

    if (action === "waitlist") {
      await prisma.$transaction(async (tx) => {
        await tx.teacherRequest.update({
          where: { id },
          data: { status: TeacherRequestStatus.waitlisted, ...handled },
        });
        await createNotifications(tx, {
          userIds: audience,
          type: "teacher_request_waitlisted",
          title: "Pengajuan masuk daftar tunggu",
          body: "Kuota guru sedang penuh. Anda bisa menunggu atau memilih guru lain.",
          data: { requestId: id },
        });
      }, TX_OPTIONS);

      return apiOk({ id, status: TeacherRequestStatus.waitlisted });
    }

    if (action === "reject") {
      const reason = rejectReason as string;
      await prisma.$transaction(async (tx) => {
        await tx.teacherRequest.update({
          where: { id },
          data: {
            status: TeacherRequestStatus.rejected,
            rejectReason: reason,
            ...handled,
          },
        });
        await createNotifications(tx, {
          userIds: audience,
          type: "teacher_request_rejected",
          title: "Pengajuan belum bisa diterima",
          body: reason,
          data: { requestId: id },
        });
      }, TX_OPTIONS);

      return apiOk({ id, status: TeacherRequestStatus.rejected });
    }

    // --- approve ---

    // Guru hanya bisa menyetujui untuk dirinya sendiri; admin boleh
    // menempatkan guru pada pengajuan yang teacherId-nya kosong (BR-08.1).
    const requestedTeacherId = parsed.data.teacherId
      ? parsed.data.teacherId
      : null;
    const resolvedTeacherId = actorIsAdmin
      ? (requestedTeacherId ?? request.teacherId)
      : user.id;

    if (!resolvedTeacherId) {
      return apiError("Data tidak valid", 422, {
        teacherId: "Pilih guru yang akan menangani murid ini",
      });
    }

    const teacher = await prisma.user.findUnique({
      where: { id: resolvedTeacherId },
      select: {
        fullName: true,
        isActive: true,
        roles: { select: { role: { select: { name: true } } } },
        teacherProfile: { select: { acceptsPrivate: true } },
      },
    });
    const isTeacher = teacher?.roles.some(
      (r) => r.role.name === RoleName.teacher,
    );
    if (!teacher || !teacher.isActive || !isTeacher) {
      return apiError("Data tidak valid", 422, {
        teacherId: "Guru tidak ditemukan",
      });
    }
    if (!teacher.teacherProfile?.acceptsPrivate) {
      return apiError("Data tidak valid", 422, {
        teacherId: "Guru ini tidak menerima murid privat",
      });
    }

    const levelValue = level?.trim() ? level.trim() : null;

    const result = await prisma.$transaction(async (tx) => {
      // Unique (teacherId, studentId) membuat approve ganda idempotent:
      // baris yang sama dipakai ulang, bukan bikin penugasan kedua.
      const assignment = await tx.privateAssignment.upsert({
        where: {
          teacherId_studentId: {
            teacherId: resolvedTeacherId,
            studentId: request.studentId,
          },
        },
        create: {
          teacherId: resolvedTeacherId,
          studentId: request.studentId,
          level: levelValue,
          createdBy: user.id,
        },
        update: {
          status: PrivateAssignmentStatus.active,
          endedAt: null,
          ...(levelValue ? { level: levelValue } : {}),
        },
        select: { id: true, level: true },
      });

      await tx.teacherRequest.update({
        where: { id },
        data: {
          status: TeacherRequestStatus.approved,
          assignmentId: assignment.id,
          rejectReason: null,
          ...handled,
        },
      });

      await createNotifications(tx, {
        userIds: audience,
        type: "teacher_request_approved",
        title: "Pengajuan diterima",
        body: assignment.level
          ? `${request.student.fullName} diterima sebagai murid privat ${teacher.fullName} pada level ${assignment.level}.`
          : `${request.student.fullName} diterima sebagai murid privat ${teacher.fullName}.`,
        data: { requestId: id, assignmentId: assignment.id },
      });

      // Guru perlu tahu ketika admin yang menempatkan murid kepadanya.
      if (resolvedTeacherId !== user.id) {
        await createNotifications(tx, {
          userIds: [resolvedTeacherId],
          type: "private_assignment_created",
          title: "Murid privat baru",
          body: `${request.student.fullName} ditugaskan kepada Anda oleh admin.`,
          data: { requestId: id, assignmentId: assignment.id },
        });
      }

      return assignment;
    }, TX_OPTIONS);

    return apiOk({
      id,
      status: TeacherRequestStatus.approved,
      assignmentId: result.id,
      teacherId: resolvedTeacherId,
      level: result.level,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
