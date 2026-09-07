import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, paginationSchema, toPrismaPagination } from "@/lib/api";
import { totalPages as calcTotalPages } from "@/lib/pagination-nav";
import { RoleName } from "@/generated/prisma/enums";
import { PaginationNav } from "@/components/pagination-nav";
import { CourseManager, type CourseRow } from "./course-manager";

export const metadata: Metadata = { title: "Kurikulum" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

/**
 * Kurikulum: daftar course berpagination, tiap course beserta pohon
 * silabusnya (modul → lesson, terurut orderIndex). Dijadikan satu halaman
 * karena silabus tidak berarti apa-apa terpisah dari course-nya.
 */
export default async function AdminCoursesPage({
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

  const where = { isActive: true };
  const [rows, total] = await Promise.all([
    prisma.course.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        levelNumber: true,
        attendanceThresholdPct: true,
        modules: {
          select: {
            id: true,
            title: true,
            orderIndex: true,
            lessons: {
              select: { id: true, title: true, orderIndex: true },
              orderBy: { orderIndex: "asc" },
            },
          },
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: [{ levelNumber: "asc" }, { name: "asc" }],
      ...toPrismaPagination(pagination),
    }),
    prisma.course.count({ where }),
  ]);

  // Decimal Prisma tidak bisa menyeberang ke client component apa adanya.
  const courses: CourseRow[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    levelNumber: c.levelNumber,
    attendanceThresholdPct: Number(c.attendanceThresholdPct),
    modules: c.modules,
  }));

  const pages = calcTotalPages(total, pagination.pageSize);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Kurikulum
        </h1>
        <p className="text-sm text-plum-500">
          Course, modul, dan lesson untuk kelas reguler. {total} course aktif.
        </p>
      </div>

      <CourseManager courses={courses} />

      <PaginationNav
        pathname="/admin/courses"
        params={{}}
        page={pagination.page}
        totalPages={pages}
      />
    </div>
  );
}
