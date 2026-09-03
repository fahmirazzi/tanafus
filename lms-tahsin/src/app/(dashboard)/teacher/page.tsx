import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { RoleName } from "@/generated/prisma/enums";
import { DashboardHeader } from "@/components/layout/dashboard-header";

export const metadata: Metadata = { title: "Dashboard Guru" };

export default async function GuruDashboardPage() {
  const user = await requireRole(RoleName.teacher);

  return (
    <DashboardHeader
      title="Dashboard Guru"
      subtitle={`Assalamu'alaikum, ${user.name ?? "Ustadz/Ustadzah"}.`}
      roles={user.roles}
      note="Kalender mingguan, daftar murid, feedback sesi, dan ringkasan upah sudah tersedia di menu samping."
    />
  );
}
