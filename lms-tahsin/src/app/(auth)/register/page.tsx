import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Daftar" };

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800">
          Daftar Orang Tua
        </h1>
        <p className="text-sm text-plum-500">
          Buat akun wali dan daftarkan data anak Anda. Akun guru dan admin
          dibuat oleh pihak lembaga.
        </p>
      </div>

      <RegisterForm />

      <p className="text-center text-sm text-plum-500">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-orange-600 hover:underline">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
