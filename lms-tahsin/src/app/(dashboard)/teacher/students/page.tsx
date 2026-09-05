import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PrivateAssignmentStatus, RoleName } from "@/generated/prisma/enums";
import { PRIVATE_ASSIGNMENT_LABEL } from "@/lib/labels";
import { DEFAULT_PAGE_SIZE, paginationSchema, toPrismaPagination } from "@/lib/api";
import { totalPages as calcTotalPages } from "@/lib/pagination-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationNav } from "@/components/pagination-nav";

export const metadata: Metadata = { title: "Murid Saya" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

/** Daftar murid privat guru, pintu masuk ke riwayat feedback (PRD F-8). */
export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const teacher = await requireRole(RoleName.teacher);
  const params = await searchParams;

  // Query string tidak valid diperlakukan sebagai "halaman 1", bukan error
  // -- sama seperti admin/users/page.tsx, memakai skema pagination bersama
  // supaya aturan validasi dan defaultnya tidak dobel-diimplementasikan.
  const parsedPagination = paginationSchema.safeParse({
    page: one(params.page),
    pageSize: one(params.pageSize),
  });
  const pagination = parsedPagination.success
    ? parsedPagination.data
    : { page: 1, pageSize: DEFAULT_PAGE_SIZE };

  const where = {
    teacherId: teacher.id,
    status: { not: PrivateAssignmentStatus.ended },
  };

  const [assignments, total] = await Promise.all([
    prisma.privateAssignment.findMany({
      where,
      select: {
        status: true,
        level: true,
        student: {
          select: { id: true, fullName: true, suspendedAt: true },
        },
      },
      orderBy: { student: { fullName: "asc" } },
      ...toPrismaPagination(pagination),
    }),
    prisma.privateAssignment.count({ where }),
  ]);

  const pages = calcTotalPages(total, pagination.pageSize);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Murid saya
        </h1>
        <p className="text-sm text-plum-500">
          Riwayat penilaian dan feedback tiap murid privat.
        </p>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-plum-500">
            Belum ada murid privat yang ditugaskan kepada Anda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => (
            <Card key={assignment.student.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {assignment.student.fullName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {PRIVATE_ASSIGNMENT_LABEL[assignment.status]}
                  </Badge>
                  {/* BR-04.6: guru perlu tahu sebelum mencoba menjadwalkan. */}
                  {assignment.student.suspendedAt ? (
                    <Badge variant="destructive">Disuspend</Badge>
                  ) : null}
                  {assignment.level ? (
                    <span className="text-xs text-plum-500">
                      {assignment.level}
                    </span>
                  ) : null}
                </div>
                {assignment.student.suspendedAt ? (
                  <p className="text-xs text-plum-500">
                    Tagihan menunggak. Sesi baru belum bisa dijadwalkan; sesi
                    yang sudah ada tetap berjalan.
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={`/teacher/students/${assignment.student.id}`} />
                  }
                >
                  Lihat progres
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PaginationNav
        pathname="/teacher/students"
        params={{}}
        page={pagination.page}
        totalPages={pages}
      />
    </div>
  );
}
