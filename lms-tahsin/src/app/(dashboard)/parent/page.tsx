import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { RoleName } from "@/generated/prisma/enums";
import { DashboardHeader } from "@/components/layout/dashboard-header";

export const metadata: Metadata = { title: "Dashboard Orang Tua" };

export default async function OrangtuaDashboardPage() {
  const user = await requireRole(RoleName.parent, RoleName.student);

  return (
    <DashboardHeader
      title="Dashboard Orang Tua"
      subtitle={`Assalamu'alaikum, ${user.name ?? "Wali"}.`}
      roles={user.roles}
      note="Progres dan feedback anak sudah tersedia di menu Progres. Halaman tagihan menyusul di Sprint 4."
    />
  );
}
