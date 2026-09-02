import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasRole, requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { RoleName } from "@/generated/prisma/enums";
import { ROLE_LABEL, RELATION_LABEL } from "@/lib/labels";
import { formatTanggalWIB, toDateInputWIB } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserEditForm } from "./user-edit-form";
import { RolesForm } from "./roles-form";
import { ChildrenManager } from "./children-manager";
import { TeacherSettingsForm } from "./teacher-settings-form";

export const metadata: Metadata = { title: "Detail Pengguna" };

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole(RoleName.super_admin, RoleName.admin);
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      gender: true,
      birthDate: true,
      address: true,
      isActive: true,
      billingPreference: true,
      createdAt: true,
      roles: { select: { role: { select: { name: true } } } },
      // CATATAN SCHEMA: penamaan relasi ParentStudent terbalik dari intuisi.
      // `parents` = baris di mana user ini BERPERAN sebagai orang tua,
      // jadi isinya daftar anaknya. Lihat catatan yang sama di auth-guard.ts.
      parents: {
        select: {
          relation: true,
          isPrimary: true,
          student: { select: { id: true, fullName: true, isActive: true } },
        },
      },
      // `children` = baris di mana user ini adalah murid -> daftar orang tuanya.
      children: {
        select: {
          relation: true,
          isPrimary: true,
          parent: { select: { id: true, fullName: true } },
        },
      },
      teacherProfile: {
        select: {
          revenueSharePct: true,
          acceptsPrivate: true,
          acceptingStudents: true,
        },
      },
    },
  });

  if (!user) notFound();

  const roles = user.roles.map((r) => r.role.name);
  const isParent = roles.includes(RoleName.parent);
  const isStudent = roles.includes(RoleName.student);
  const isTeacher = roles.includes(RoleName.teacher);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/pengguna"
          className="inline-flex items-center gap-1 text-sm text-plum-500 hover:text-plum-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar pengguna
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            {user.fullName}
          </h1>
          <Badge variant={user.isActive ? "default" : "destructive"}>
            {user.isActive ? "Aktif" : "Nonaktif"}
          </Badge>
        </div>
        <p className="text-sm text-plum-500">
          {roles.map((r) => ROLE_LABEL[r]).join(", ")} · terdaftar{" "}
          {formatTanggalWIB(user.createdAt)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data profil</CardTitle>
        </CardHeader>
        <CardContent>
          <UserEditForm
            userId={user.id}
            initialIsActive={user.isActive}
            initial={{
              fullName: user.fullName,
              email: user.email ?? "",
              phone: user.phone ?? "",
              gender: user.gender ?? "",
              birthDate: user.birthDate ? toDateInputWIB(user.birthDate) : "",
              address: user.address ?? "",
              billingPreference: user.billingPreference,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role</CardTitle>
        </CardHeader>
        <CardContent>
          <RolesForm
            userId={user.id}
            initialRoles={roles}
            canAssignSuperAdmin={hasRole(actor, RoleName.super_admin)}
          />
        </CardContent>
      </Card>

      {isTeacher ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pengaturan guru</CardTitle>
          </CardHeader>
          <CardContent>
            <TeacherSettingsForm
              userId={user.id}
              hasProfile={user.teacherProfile !== null}
              initialRevenueSharePct={
                user.teacherProfile
                  ? Number(user.teacherProfile.revenueSharePct)
                  : 60
              }
              acceptsPrivate={user.teacherProfile?.acceptsPrivate ?? false}
              acceptingStudents={
                user.teacherProfile?.acceptingStudents ?? false
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {isParent ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anak yang terhubung</CardTitle>
          </CardHeader>
          <CardContent>
            <ChildrenManager
              parentId={user.id}
              linkedChildren={user.parents.map((link) => ({
                id: link.student.id,
                fullName: link.student.fullName,
                isActive: link.student.isActive,
                relation: link.relation,
                isPrimary: link.isPrimary,
              }))}
            />
          </CardContent>
        </Card>
      ) : null}

      {isStudent ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orang tua / wali</CardTitle>
          </CardHeader>
          <CardContent>
            {user.children.length === 0 ? (
              <p className="text-sm text-plum-500">
                Belum ada orang tua yang terhubung. Hubungkan dari halaman detail
                orang tuanya.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {user.children.map((link) => (
                  <li
                    key={link.parent.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/pengguna/${link.parent.id}`}
                          className="font-medium text-plum-800 underline underline-offset-4"
                        >
                          {link.parent.fullName}
                        </Link>
                        {link.isPrimary ? <Badge>Wali utama</Badge> : null}
                      </div>
                      <p className="text-xs text-plum-500">
                        {RELATION_LABEL[link.relation]}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
