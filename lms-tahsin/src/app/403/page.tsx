import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getSessionUser, homeForRoles } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Akses Ditolak" };

export default async function ForbiddenPage() {
  const user = await getSessionUser();
  const home = user ? homeForRoles(user.roles) : "/login";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldAlert className="size-12 text-orange-500" aria-hidden />
      <h1 className="font-heading text-2xl font-semibold text-plum-800">
        403 — Akses Ditolak
      </h1>
      <p className="max-w-sm text-sm text-plum-500">
        Akun Anda tidak memiliki hak untuk membuka halaman ini.
      </p>
      <Link
        href={home}
        className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
      >
        Kembali ke dashboard
      </Link>
    </main>
  );
}
