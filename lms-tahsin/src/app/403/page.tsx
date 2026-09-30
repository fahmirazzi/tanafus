import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getSessionUser, homeForRoles } from "@/lib/auth-guard";
import { tombolUtama } from "@/components/landing/gaya";

export const metadata: Metadata = { title: "Akses Ditolak" };

export default async function ForbiddenPage() {
  const user = await getSessionUser();
  const home = user ? homeForRoles(user.roles) : "/login";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldAlert className="size-12 text-primary" aria-hidden />
      <h1 className="font-heading text-3xl font-bold text-foreground">
        403 — Akses Ditolak
      </h1>
      <p className="max-w-sm text-muted-foreground">
        Akun Anda tidak memiliki hak untuk membuka halaman ini.
      </p>
      <Link href={home} className={`${tombolUtama} mt-2`}>
        Kembali ke dashboard
      </Link>
    </main>
  );
}
