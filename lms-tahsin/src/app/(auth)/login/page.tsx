import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800">
          Masuk
        </h1>
        <p className="text-sm text-plum-500">
          Gunakan email dan kata sandi akun Anda.
        </p>
      </div>

      {/* LoginForm memakai useSearchParams -> wajib di dalam Suspense. */}
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-lg bg-cream-100" />}
      >
        <LoginForm />
      </Suspense>

      <p className="text-center text-sm text-plum-500">
        Belum punya akun?{" "}
        <Link href="/register" className="font-medium text-orange-600 hover:underline">
          Daftar sebagai orang tua
        </Link>
      </p>
    </div>
  );
}
