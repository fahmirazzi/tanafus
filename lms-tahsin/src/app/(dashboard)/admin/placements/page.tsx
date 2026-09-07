import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, paginationSchema, toPrismaPagination } from "@/lib/api";
import { totalPages as calcTotalPages } from "@/lib/pagination-nav";
import { formatTanggalWIB } from "@/lib/datetime";
import { RoleName } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationNav } from "@/components/pagination-nav";
import { PlacementManager, type PlacementRow } from "./placement-manager";

export const metadata: Metadata = { title: "Placement" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

/** Daftar hasil placement + form catat baru (spec B2 §3.4). */
export default async function AdminPlacementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(RoleName.super_admin, RoleName.admin);
  const params = await searchParams;

  const parsedPagination = paginationSchema.safeParse({
    page: one(params.page),
    pageSize: one(params.pageSize),
  });
  const pagination = parsedPagination.success
    ? parsedPagination.data
    : { page: 1, pageSize: DEFAULT_PAGE_SIZE };

  const [rows, total, students, courses] = await Promise.all([
    prisma.placementRecord.findMany({
      select: {
        id: true,
        studentId: true,
        quizScore: true,
        interviewNotes: true,
        audioUrl: true,
        verdict: true,
        recommendedCourseId: true,
        status: true,
        createdAt: true,
        student: { select: { fullName: true } },
        recommendedCourse: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      ...toPrismaPagination(pagination),
    }),
    prisma.placementRecord.count(),
    prisma.user.findMany({
      where: { roles: { some: { role: { name: RoleName.student } } } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.course.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const pages = calcTotalPages(total, pagination.pageSize);

  const placements: PlacementRow[] = rows.map((r) => ({
    id: r.id,
    studentName: r.student.fullName,
    quizScore: r.quizScore ? Number(r.quizScore) : null,
    verdict: r.verdict,
    recommendedCourseName: r.recommendedCourse?.name ?? null,
    status: r.status,
    createdAtLabel: formatTanggalWIB(r.createdAt),
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Placement
        </h1>
        <p className="text-sm text-plum-500">
          {total} catatan hasil placement. Placement TIDAK memblokir
          enrollment — murid tetap bisa didaftarkan langsung ke kelas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar & catat placement</CardTitle>
        </CardHeader>
        <CardContent>
          <PlacementManager
            placements={placements}
            students={students}
            courses={courses}
          />
        </CardContent>
      </Card>

      <PaginationNav
        pathname="/admin/placements"
        params={{}}
        page={pagination.page}
        totalPages={pages}
      />
    </div>
  );
}
