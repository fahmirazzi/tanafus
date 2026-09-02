import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole, hasRole } from "@/lib/auth-guard";
import { RoleName } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCreateForm } from "./user-create-form";

export const metadata: Metadata = { title: "Tambah Pengguna" };

export default async function CreateUserPage() {
  const actor = await requireRole(RoleName.super_admin, RoleName.admin);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-plum-500 hover:text-plum-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar pengguna
        </Link>
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Tambah pengguna
        </h1>
        <p className="text-sm text-plum-500">
          Akun guru, admin, dan murid dibuat di sini. Orang tua bisa mendaftar
          sendiri lewat halaman registrasi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data pengguna</CardTitle>
        </CardHeader>
        <CardContent>
          <UserCreateForm
            canAssignSuperAdmin={hasRole(actor, RoleName.super_admin)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
