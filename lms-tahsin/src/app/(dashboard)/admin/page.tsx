import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { RoleName } from "@/generated/prisma/enums";
import { DashboardHeader } from "@/components/layout/dashboard-header";

export const metadata: Metadata = { title: "Dashboard Admin" };

export default async function AdminDashboardPage() {
  const user = await requireRole(RoleName.super_admin, RoleName.admin);

  return (
    <DashboardHeader
      title="Dashboard Admin"
      subtitle={`Selamat datang, ${user.name ?? "Admin"}.`}
      roles={user.roles}
      note="Modul operasional (verifikasi pembayaran, approval cuti, kelola user) menyusul di Sprint 1."
    />
  );
}
