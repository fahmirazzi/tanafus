import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Jumlah notifikasi belum dibaca dirender di server bersama menunya, jadi
  // angkanya ikut menyegar setiap navigasi tanpa polling dari browser.
  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar
        roles={user.roles}
        userName={user.name ?? "Pengguna"}
        unreadCount={unreadCount}
      />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
