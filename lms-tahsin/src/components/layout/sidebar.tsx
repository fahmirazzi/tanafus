"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  CalendarDays,
  CalendarClock,
  CalendarOff,
  GraduationCap,
  TrendingUp,
  Wallet,
  Receipt,
  HandCoins,
  FileSpreadsheet,
  UserRound,
  Inbox,
  RefreshCw,
  Plane,
  ShieldCheck,
  UserMinus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleName } from "@/generated/prisma/enums";
import { rolesInclude } from "@/lib/roles";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: readonly RoleName[];
  /** Menu notifikasi menampilkan jumlah yang belum dibaca. */
  showUnread?: boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/admin/users",
    label: "Pengguna",
    icon: Users,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/admin/pricing",
    label: "Tarif",
    icon: Wallet,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/admin/requests",
    label: "Permintaan",
    icon: Inbox,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/admin/leaves",
    label: "Cuti guru",
    icon: Plane,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/admin/invoices",
    label: "Tagihan",
    icon: Receipt,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/admin/payouts",
    label: "Upah & payout",
    icon: HandCoins,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/admin/deletions",
    label: "Hapus akun",
    icon: UserMinus,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/admin/reports",
    label: "Laporan",
    icon: FileSpreadsheet,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/teacher",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [RoleName.teacher],
  },
  {
    href: "/teacher/requests",
    label: "Permintaan",
    icon: Inbox,
    roles: [RoleName.teacher],
  },
  {
    href: "/teacher/sessions",
    label: "Sesi",
    icon: CalendarClock,
    roles: [RoleName.teacher],
  },
  {
    href: "/teacher/schedule",
    label: "Jadwal",
    icon: CalendarDays,
    roles: [RoleName.teacher],
  },
  {
    href: "/teacher/reschedule-requests",
    label: "Usulan reschedule",
    icon: RefreshCw,
    roles: [RoleName.teacher],
  },
  {
    href: "/teacher/students",
    label: "Murid saya",
    icon: GraduationCap,
    roles: [RoleName.teacher],
  },
  {
    href: "/teacher/breaks",
    label: "Libur murid",
    icon: CalendarOff,
    roles: [RoleName.teacher],
  },
  {
    href: "/teacher/leave",
    label: "Cuti saya",
    icon: Plane,
    roles: [RoleName.teacher],
  },
  {
    href: "/teacher/earnings",
    label: "Upah saya",
    icon: HandCoins,
    roles: [RoleName.teacher],
  },
  {
    href: "/teacher/profile",
    label: "Profil",
    icon: UserRound,
    roles: [RoleName.teacher],
  },
  {
    href: "/parent",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [RoleName.parent, RoleName.student],
  },
  {
    href: "/parent/schedule",
    label: "Jadwal",
    icon: CalendarDays,
    roles: [RoleName.parent, RoleName.student],
  },
  {
    href: "/parent/enrollment",
    label: "Pendaftaran privat",
    icon: Inbox,
    roles: [RoleName.parent, RoleName.student],
  },
  {
    href: "/parent/progress",
    label: "Progres",
    icon: TrendingUp,
    roles: [RoleName.parent, RoleName.student],
  },
  {
    href: "/parent/billing",
    label: "Tagihan",
    icon: Receipt,
    roles: [RoleName.parent, RoleName.student],
  },
  {
    href: "/parent/breaks",
    label: "Libur",
    icon: CalendarOff,
    roles: [RoleName.parent, RoleName.student],
  },
  {
    href: "/parent/leave-coverage",
    label: "Cuti guru anak",
    icon: Plane,
    roles: [RoleName.parent, RoleName.student],
  },
  {
    href: "/parent/account",
    label: "Data & akun",
    icon: ShieldCheck,
    roles: [RoleName.parent, RoleName.student],
  },
  {
    href: "/notifications",
    label: "Notifikasi",
    icon: Bell,
    roles: [
      RoleName.super_admin,
      RoleName.admin,
      RoleName.teacher,
      RoleName.parent,
      RoleName.student,
    ],
    showUnread: true,
  },
];

export function Sidebar({
  roles,
  userName,
  unreadCount,
}: {
  roles: RoleName[];
  userName: string;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => rolesInclude(roles, item.roles));

  // Prefix terpanjang yang cocok yang menang, supaya "/admin" tidak ikut
  // menyala saat pengguna berada di "/admin/users".
  const activeHref = items
    .filter(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      {/* Topbar mobile */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          className="rounded-md p-2 text-plum-700 hover:bg-cream-100"
        >
          <Menu className="size-5" />
        </button>
        <span className="font-heading text-lg font-semibold text-plum-800">
          Tanafus
        </span>
      </header>

      {open ? (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-plum-950/50 md:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div>
            <p className="font-heading text-lg font-semibold text-white">
              Tanafus Center
            </p>
            <p className="text-xs text-plum-400">
              Membina Bacaan Al-Qur&apos;an
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
            className="rounded-md p-1 text-plum-300 hover:bg-sidebar-accent md:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {items.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-orange-500 text-white"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.showUnread && unreadCount > 0 ? (
                  <span
                    aria-label={`${unreadCount} belum dibaca`}
                    className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-4">
          <p className="truncate px-3 pb-2 text-sm text-plum-200">{userName}</p>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-plum-200 transition-colors hover:bg-sidebar-accent hover:text-white"
          >
            <LogOut className="size-4 shrink-0" />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
