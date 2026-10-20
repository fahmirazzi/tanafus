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
  BookOpen,
  CalendarRange,
  School,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleName } from "@/generated/prisma/enums";
import { rolesInclude } from "@/lib/roles";
import { TombolTema } from "@/components/tema/tombol-tema";
import { Logo } from "@/components/layout/logo";

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
    href: "/admin/courses",
    label: "Kurikulum",
    icon: BookOpen,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/admin/periods",
    label: "Periode ajar",
    icon: CalendarRange,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/admin/classes",
    label: "Kelas reguler",
    icon: School,
    roles: [RoleName.super_admin, RoleName.admin],
  },
  {
    href: "/admin/placements",
    label: "Placement",
    icon: ClipboardList,
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
    href: "/teacher/classes",
    label: "Kelas saya",
    icon: School,
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
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          className="rounded-full p-2 text-foreground transition-colors hover:bg-muted active:scale-95"
        >
          <Menu className="size-5" />
        </button>
        <Logo />
        <TombolTema className="ml-auto" />
      </header>

      {open ? (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-in fade-in-0 md:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:sticky md:top-0 md:h-dvh md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div>
            <Logo className="text-xl" />
            <p className="mt-0.5 text-xs text-muted-foreground">
              Berlomba menuju bacaan terbaik.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground md:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {items.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/menu relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-[background-color,color,translate] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  active
                    ? "bg-sidebar-accent font-semibold text-foreground"
                    : "font-medium text-muted-foreground hover:translate-x-0.5 hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                {/* Penanda menu aktif: titik merah brand, muncul memantul. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -left-1.5 size-1.5 rounded-full bg-primary transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    active ? "scale-100" : "scale-0",
                  )}
                />
                <item.icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    active ? "text-primary" : "group-hover/menu:text-foreground",
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {item.showUnread && unreadCount > 0 ? (
                  <span
                    aria-label={`${unreadCount} belum dibaca`}
                    className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-4">
          <div className="flex items-center gap-2 px-3 pb-2">
            <p className="flex-1 truncate text-sm font-semibold">{userName}</p>
            <TombolTema className="hidden md:inline-flex" />
          </div>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="size-4 shrink-0" />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
