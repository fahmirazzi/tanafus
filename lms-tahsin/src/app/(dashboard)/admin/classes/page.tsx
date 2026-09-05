import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, paginationSchema, toPrismaPagination } from "@/lib/api";
import { totalPages as calcTotalPages } from "@/lib/pagination-nav";
import { formatRupiah } from "@/lib/currency";
import { RoleName } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationNav } from "@/components/pagination-nav";
import { ClassGroupForm } from "./class-group-form";

export const metadata: Metadata = { title: "Kelas Reguler" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

const AUDIENCE_LABEL: Record<string, string> = {
  children: "Anak-anak",
  adult: "Dewasa",
};

/** Daftar kelas reguler (class group) + form tambah. */
export default async function AdminClassesPage({
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

  const [rows, total, courses, periods, teachers] = await Promise.all([
    prisma.classGroup.findMany({
      select: {
        id: true,
        name: true,
        audience: true,
        status: true,
        capacity: true,
        honorPerSession: true,
        course: { select: { name: true } },
        period: { select: { name: true } },
        teacher: { select: { fullName: true } },
      },
      orderBy: { name: "asc" },
      ...toPrismaPagination(pagination),
    }),
    prisma.classGroup.count(),
    prisma.course.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.academicPeriod.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: { name: RoleName.teacher } } } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const pages = calcTotalPages(total, pagination.pageSize);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Kelas reguler
        </h1>
        <p className="text-sm text-plum-500">{total} kelas terdaftar.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buat kelas baru</CardTitle>
        </CardHeader>
        <CardContent>
          <ClassGroupForm courses={courses} periods={periods} teachers={teachers} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar kelas</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-plum-500">
              Belum ada kelas reguler.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Guru</TableHead>
                  <TableHead>Audiens</TableHead>
                  <TableHead>Honor/sesi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-plum-800">
                      {c.name}
                    </TableCell>
                    <TableCell>{c.course.name}</TableCell>
                    <TableCell>{c.period.name}</TableCell>
                    <TableCell>{c.teacher.fullName}</TableCell>
                    <TableCell>{AUDIENCE_LABEL[c.audience] ?? c.audience}</TableCell>
                    <TableCell>{formatRupiah(Number(c.honorPerSession))}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "open" ? "default" : "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/classes/${c.id}`}
                        className="text-sm text-plum-700 underline underline-offset-4 hover:text-plum-800"
                      >
                        Detail
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaginationNav
        pathname="/admin/classes"
        params={{}}
        page={pagination.page}
        totalPages={pages}
      />
    </div>
  );
}
