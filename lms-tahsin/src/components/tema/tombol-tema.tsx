"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { simpanTema, terapkanTema, type Tema } from "@/lib/tema";

/** Berlangganan perubahan kelas `.dark` di <html> (dari tombol mana pun). */
function berlangganan(ubah: () => void) {
  const pengamat = new MutationObserver(ubah);
  pengamat.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => pengamat.disconnect();
}
const sedangGelap = () => document.documentElement.classList.contains("dark");

/**
 * Tombol ganti tema terang/gelap.
 *
 * Ikon matahari dan bulan bertukar lewat varian `dark:` (CSS), jadi selalu
 * sesuai tema bahkan sebelum React hidup. Pergantian tema memakai crossfade
 * singkat (View Transitions API, 200 ms, globals.css). Browser tanpa dukungan,
 * atau pengguna yang meminta gerak dikurangi, langsung berganti.
 */
export function TombolTema({ className }: { className?: string }) {
  const gelap = useSyncExternalStore(berlangganan, sedangGelap, () => false);

  const ganti = () => {
    const berikut: Tema = sedangGelap() ? "terang" : "gelap";
    const terapkan = () => {
      terapkanTema(berikut);
      simpanTema(berikut);
    };

    const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || kurangiGerak) {
      terapkan();
      return;
    }

    // Transisi dibatalkan (mis. tombol ditekan beruntun): tema tetap berganti.
    document.startViewTransition(terapkan).ready.catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={ganti}
      aria-label={gelap ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      title={gelap ? "Mode terang" : "Mode gelap"}
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-current transition-colors hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95",
        className,
      )}
    >
      <Sun
        aria-hidden="true"
        strokeWidth={2}
        className="absolute size-[1.1rem] rotate-0 scale-100 opacity-100 transition-[rotate,scale,opacity] duration-200 ease-out dark:-rotate-90 dark:scale-50 dark:opacity-0"
      />
      <Moon
        aria-hidden="true"
        strokeWidth={2}
        className="absolute size-[1.05rem] rotate-90 scale-50 opacity-0 transition-[rotate,scale,opacity] duration-200 ease-out dark:rotate-0 dark:scale-100 dark:opacity-100"
      />
    </button>
  );
}
