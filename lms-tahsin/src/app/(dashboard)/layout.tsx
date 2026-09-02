import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar roles={user.roles} userName={user.name ?? "Pengguna"} />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
