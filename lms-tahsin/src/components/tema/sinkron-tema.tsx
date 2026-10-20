"use client";

import { useLayoutEffect } from "react";
import { KUNCI_TEMA, sistemGelap, temaBerlaku, temaTersimpan, terapkanTema } from "@/lib/tema";

/**
 * Menjaga kelas tema di <html> tetap benar setelah halaman hidup.
 *
 * - Di development, Strict Mode memasang ulang <html> dan menghapus kelas
 *   yang dipasang skrip <head>; efek ini memasangnya lagi sebelum digambar.
 *   Di production ini tidak mengubah apa-apa.
 * - Selama pengguna belum memilih tema sendiri, tema mengikuti perubahan
 *   pengaturan sistem secara langsung.
 * - Pilihan di tab lain ikut diterapkan (event "storage").
 */
export function SinkronTema() {
  useLayoutEffect(() => {
    terapkanTema(temaBerlaku());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const ikutSistem = () => {
      if (!temaTersimpan()) terapkanTema(sistemGelap() ? "gelap" : "terang");
    };
    const dariTabLain = (e: StorageEvent) => {
      if (e.key === KUNCI_TEMA) terapkanTema(temaBerlaku());
    };
    media.addEventListener("change", ikutSistem);
    window.addEventListener("storage", dariTabLain);
    return () => {
      media.removeEventListener("change", ikutSistem);
      window.removeEventListener("storage", dariTabLain);
    };
  }, []);

  return null;
}
