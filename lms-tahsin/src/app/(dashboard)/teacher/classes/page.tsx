import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, paginationSchema, toPrismaPagination } from "@/lib/api";
import { totalPages as calcTotalPages } from "@/lib/pagination-nav";
import { RoleName } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationNav } from "@/components/pagination-nav";

export const metadata: Metadata = { title: "Kelas Saya" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

const AUDIENCE_LABEL: Record<string, string> = {
  children: "Anak-anak",
  adult: "Dewasa",
};

/** Kelas reguler milik guru yang sedang masuk. */
export default async function TeacherClassesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const teacher = await requireRole(RoleName.teacher);
  const params = await searchParams;

  const parsedPagination = paginationSchema.safeParse({
    page: one(params.page),
    pageSize: one(params.pageSize),
  });
  const pagination = parsedPagination.success
    ? parsedPagination.data
    : { page: 1, pageSize: DEFAULT_PAGE_SIZE };

  const where = { teacherId: teacher.id };
  const [rows, total] = await Promise.all([
    prisma.classGroup.findMany({
      where,
      select: {
        id: true,
        name: true,
        audience: true,
        status: true,
        honorPerSession: true,
        course: { select: { name: true } },
        period: { select: { name: true } },
        _count: { select: { enrollments: { where: { status: "active" } } } },
      },
      orderBy: { name: "asc" },
      ...toPrismaPagination(pagination),
    }),
    prisma.classGroup.count({ where }),
  ]);

  const pages = calcTotalPages(total, pagination.pageSize);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Kelas saya
        </h1>
        <p className="text-sm text-plum-500">
          {total} kelas reguler yang Anda ajar.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-plum-500">
            Belum ada kelas reguler yang ditugaskan kepada Anda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.name}</CardTitle>
                <p className="text-xs text-plum-500">
                  {c.course.name} · {c.period.name}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={c.status === "open" ? "default" : "secondary"}>
                    {c.status}
                  </Badge>
                  <span className="text-xs text-plum-500">
                    {AUDIENCE_LABEL[c.audience] ?? c.audience} ·{" "}
                    {c._count.enrollments} murid
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/teacher/classes/${c.id}`} />}
                >
                  Buka kelas
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PaginationNav
        pathname="/teacher/classes"
        params={{}}
        page={pagination.page}
        totalPages={pages}
      />
    </div>
  );
}
