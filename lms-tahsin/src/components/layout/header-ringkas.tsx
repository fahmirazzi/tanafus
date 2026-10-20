import { Logo } from "@/components/layout/logo";
import { TombolTema } from "@/components/tema/tombol-tema";

/**
 * Header halaman di luar dashboard (auth, daftar guru publik): logo, isi
 * tambahan di kanan (mis. tautan Masuk), dan tombol tema.
 */
export function HeaderRingkas({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-8">
      <Logo className="text-xl" />
      <div className="flex items-center gap-4">
        {children}
        <TombolTema />
      </div>
    </header>
  );
}
