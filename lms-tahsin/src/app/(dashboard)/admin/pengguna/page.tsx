import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { RoleName } from "@/generated/prisma/enums";
import { USER_LIST_SELECT, buildUserWhere } from "@/lib/users";
import { userListQuerySchema } from "@/lib/validations/user";
import { paginationSchema, toPrismaPagination } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/labels";
import { formatTanggalWIB } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Kelola Pengguna" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(RoleName.super_admin, RoleName.admin);
  const params = await searchParams;

  // Filter tidak valid diperlakukan sebagai "tanpa filter", bukan error —
  // halaman daftar tidak boleh gagal hanya karena query string dikutak-katik.
  const parsedQuery = userListQuerySchema.safeParse({
    q: one(params.q),
    role: one(params.role),
    status: one(params.status),
  });
  const query = parsedQuery.success ? parsedQuery.data : {};

  const parsedPagination = paginationSchema.safeParse({
    page: one(params.page),
    pageSize: one(params.pageSize),
  });
  const pagination = parsedPagination.success
    ? parsedPagination.data
    : { page: 1, pageSize: 20 };

  const where = buildUserWhere(query);
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_LIST_SELECT,
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
      ...toPrismaPagination(pagination),
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));

  function pageHref(page: number): string {
    const next = new URLSearchParams();
    if (query.q) next.set("q", query.q);
    if (query.role) next.set("role", query.role);
    if (query.status) next.set("status", query.status);
    next.set("page", String(page));
    return `/admin/pengguna?${next.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            Kelola pengguna
          </h1>
          <p className="text-sm text-plum-500">
            {total} pengguna terdaftar.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/admin/pengguna/baru" />}>
          <Plus data-icon="inline-start" />
          Tambah pengguna
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="q">Cari</Label>
              <Input
                id="q"
                name="q"
                defaultValue={query.q ?? ""}
                placeholder="Nama, email, atau nomor HP"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                defaultValue={query.role ?? ""}
                className={selectClass}
              >
                <option value="">Semua role</option>
                {Object.values(RoleName).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={query.status ?? ""}
                className={selectClass}
              >
                <option value="">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>

            <Button type="submit" variant="outline">
              <Search data-icon="inline-start" />
              Terapkan
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-plum-500">
              Tidak ada pengguna yang cocok dengan filter ini.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Terdaftar</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-plum-800">
                      {user.fullName}
                    </TableCell>
                    <TableCell className="text-plum-500">
                      <div>{user.email ?? "—"}</div>
                      <div className="text-xs">{user.phone ?? ""}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {user.roles.map((r) => (
                          <Badge key={r.role.name} variant="secondary">
                            {ROLE_LABEL[r.role.name]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "destructive"}>
                        {user.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-plum-500">
                      {formatTanggalWIB(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/pengguna/${user.id}`}
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

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-plum-500">
          <span>
            Halaman {pagination.page} dari {totalPages}
          </span>
          <div className="flex gap-2">
            {pagination.page > 1 ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={pageHref(pagination.page - 1)} />}
              >
                Sebelumnya
              </Button>
            ) : null}
            {pagination.page < totalPages ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={pageHref(pagination.page + 1)} />}
              >
                Berikutnya
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
