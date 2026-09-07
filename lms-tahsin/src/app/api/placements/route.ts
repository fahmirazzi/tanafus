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
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { placementSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const PLACEMENT_SELECT = {
  id: true,
  studentId: true,
  quizScore: true,
  interviewNotes: true,
  audioUrl: true,
  verdict: true,
  recommendedCourseId: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  student: { select: { fullName: true } },
  recommendedCourse: { select: { name: true } },
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const url = new URL(req.url);
    const pagination = parsePagination(url);
    const studentId = url.searchParams.get("studentId") ?? undefined;

    const where: Prisma.PlacementRecordWhereInput = studentId
      ? { studentId }
      : {};

    const [rows, total] = await Promise.all([
      prisma.placementRecord.findMany({
        where,
        select: PLACEMENT_SELECT,
        orderBy: { createdAt: "desc" },
        ...toPrismaPagination(pagination),
      }),
      prisma.placementRecord.count({ where }),
    ]);

    return apiList(rows, total, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const body: unknown = await req.json();
    const parsed = placementSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const student = await prisma.user.findFirst({
      where: {
        id: parsed.data.studentId,
        deletedAt: null,
        roles: { some: { role: { name: RoleName.student } } },
      },
      select: { id: true },
    });
    if (!student) {
      return apiError("Data tidak valid", 422, {
        studentId: "Murid tidak ditemukan",
      });
    }

    const created = await prisma.placementRecord.create({
      data: {
        studentId: parsed.data.studentId,
        quizScore: parsed.data.quizScore,
        interviewNotes: parsed.data.interviewNotes || undefined,
        audioUrl: parsed.data.audioUrl || undefined,
        verdict: parsed.data.verdict,
        recommendedCourseId: parsed.data.recommendedCourseId,
      },
      select: { id: true },
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
