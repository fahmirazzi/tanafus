import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, paginationSchema, toPrismaPagination } from "@/lib/api";
import { totalPages as calcTotalPages } from "@/lib/pagination-nav";
import { formatTanggalWIB } from "@/lib/datetime";
import { RoleName } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationNav } from "@/components/pagination-nav";
import { PeriodManager, type PeriodRow } from "./period-manager";

export const metadata: Metadata = { title: "Periode Ajar" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

/** Periode ajar (semester/term) yang menaungi kelas reguler (spec B1 §2). */
export default async function AdminPeriodsPage({
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
    prisma.academicPeriod.findMany({
      where,
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { startDate: "desc" },
      ...toPrismaPagination(pagination),
    }),
    prisma.academicPeriod.count({ where }),
  ]);

  const periods: PeriodRow[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    startLabel: formatTanggalWIB(p.startDate),
    endLabel: formatTanggalWIB(p.endDate),
  }));

  const pages = calcTotalPages(total, pagination.pageSize);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Periode ajar
        </h1>
        <p className="text-sm text-plum-500">
          {total} periode terdaftar. Kelas reguler wajib menaungi satu
          periode.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar periode</CardTitle>
        </CardHeader>
        <CardContent>
          <PeriodManager periods={periods} />
        </CardContent>
      </Card>

      <PaginationNav
        pathname="/admin/periods"
        params={{}}
        page={pagination.page}
        totalPages={pages}
      />
    </div>
  );
}
