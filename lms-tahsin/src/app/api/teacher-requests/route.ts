import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiError,
  apiList,
  apiOk,
  parsePagination,
  toPrismaPagination,
  zodFieldErrors,
} from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  hasRole,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import type { SessionUser } from "@/lib/auth-guard";
import { TX_OPTIONS } from "@/lib/users";
import {
  createNotifications,
  getAdminUserIds,
} from "@/lib/notifications";
import {
  createTeacherRequestSchema,
  groupPreferredTimes,
  teacherRequestListQuerySchema,
} from "@/lib/validations/teacher-request";
import { RoleName, TeacherRequestStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const LIST_SELECT = {
  id: true,
  studentId: true,
  teacherId: true,
  preferredDurations: true,
  preferredTimes: true,
  note: true,
  status: true,
  rejectReason: true,
  handledBy: true,
  handledAt: true,
  createdAt: true,
  student: { select: { id: true, fullName: true } },
  teacher: { select: { id: true, fullName: true } },
  assignment: { select: { id: true, level: true, teacherId: true } },
};

/**
 * Siapa yang boleh MENGAJUKAN untuk seorang murid (docs/02): admin, murid
 * itu sendiri, atau orang tuanya. Guru sengaja TIDAK boleh — request adalah
 * inisiatif pihak murid.
 */
async function assertCanRequestFor(
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

/** Ruang lingkup daftar request menurut peran pemanggil. */
async function scopeForViewer(
  user: SessionUser,
): Promise<Prisma.TeacherRequestWhereInput> {
  if (isAdmin(user)) return {};

  const or: Prisma.TeacherRequestWhereInput[] = [];
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

  // Tidak ada satu pun kriteria berarti tidak ada yang boleh dilihat.
  if (or.length === 0) return { id: { in: [] } };
  return { OR: or };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const url = new URL(req.url);
    const pagination = parsePagination(url);
    const parsed = teacherRequestListQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Filter tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const where: Prisma.TeacherRequestWhereInput = {
      ...(await scopeForViewer(user)),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.teacherRequest.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: "desc" },
        ...toPrismaPagination(pagination),
      }),
      prisma.teacherRequest.count({ where }),
    ]);

    return apiList(rows, total, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const body: unknown = await req.json();
    const parsed = createTeacherRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { studentId, preferredDurations, preferredTimes, note } = parsed.data;
    const teacherId = parsed.data.teacherId ? parsed.data.teacherId : null;

    await assertCanRequestFor(user, studentId);

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        fullName: true,
        roles: { select: { role: { select: { name: true } } } },
      },
    });
    if (!student) return apiError("Murid tidak ditemukan", 404);
    if (!student.roles.some((r) => r.role.name === RoleName.student)) {
      return apiError("Pengguna yang dipilih bukan murid", 422);
    }

    // Satu pengajuan terbuka per murid; mencegah kiriman ganda dan antrean
    // review yang membingungkan.
    const open = await prisma.teacherRequest.findFirst({
      where: {
        studentId,
        status: {
          in: [TeacherRequestStatus.pending, TeacherRequestStatus.waitlisted],
        },
      },
      select: { id: true },
    });
    if (open) {
      return apiError(
        "Murid ini masih punya pengajuan yang menunggu keputusan",
        422,
      );
    }

    // BR-03.1: durasi harus punya tarif aktif, kalau tidak sesinya tak bisa
    // ditagih lewat jalur normal.
    const tiers = await prisma.pricingTier.findMany({
      where: { isActive: true },
      select: { durationMinutes: true },
    });
    const activeDurations = new Set(tiers.map((t) => t.durationMinutes));
    const unknown = [...new Set(preferredDurations)].filter(
      (d) => !activeDurations.has(d),
    );
    if (unknown.length > 0) {
      return apiError("Data tidak valid", 422, {
        preferredDurations: `Durasi tanpa tarif aktif: ${unknown.join(", ")} menit`,
      });
    }

    let status: TeacherRequestStatus = TeacherRequestStatus.pending;
    let teacherName: string | null = null;

    if (teacherId) {
      const teacher = await prisma.user.findUnique({
        where: { id: teacherId },
        select: {
          fullName: true,
          isActive: true,
          roles: { select: { role: { select: { name: true } } } },
          teacherProfile: {
            select: { acceptsPrivate: true, acceptingStudents: true },
          },
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
      // BR-08.3: guru yang tidak membuka privat tidak boleh dipilih sama sekali.
      if (!teacher.teacherProfile?.acceptsPrivate) {
        return apiError("Data tidak valid", 422, {
          teacherId: "Guru ini tidak menerima murid privat",
        });
      }
      // Kuota penuh bukan penolakan — masuk daftar tunggu (skenario PRD F-1).
      if (!teacher.teacherProfile.acceptingStudents) {
        status = TeacherRequestStatus.waitlisted;
      }
      teacherName = teacher.fullName;
    }

    const adminIds = await getAdminUserIds();

    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.teacherRequest.create({
        data: {
          studentId,
          teacherId,
          preferredDurations: [...new Set(preferredDurations)],
          preferredTimes: groupPreferredTimes(preferredTimes) ?? undefined,
          note: note?.trim() ? note.trim() : null,
          status,
        },
        select: { id: true, status: true },
      });

      await createNotifications(tx, {
        userIds: [...adminIds, ...(teacherId ? [teacherId] : [])],
        type: "teacher_request_created",
        title: "Pengajuan murid privat baru",
        body: teacherName
          ? `${student.fullName} mengajukan belajar dengan ${teacherName}.`
          : `${student.fullName} mengajukan murid privat tanpa memilih guru.`,
        data: { requestId: request.id, studentId },
      });

      return request;
    }, TX_OPTIONS);

    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
