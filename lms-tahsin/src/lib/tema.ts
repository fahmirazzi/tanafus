/**
 * Tema terang/gelap seluruh aplikasi.
 *
 * Sumber kebenaran: kelas `.dark` di <html> (globals.css, varian `dark:`).
 * Pilihan pengguna disimpan di localStorage "tema" ("terang" | "gelap").
 * Bila belum pernah memilih, tema mengikuti pengaturan sistem dan ikut
 * berubah bila pengaturan sistem berubah.
 *
 * SKRIP_TEMA dijalankan di <head> (layout akar) SEBELUM halaman digambar,
 * supaya tidak ada kedipan terang sesaat di mode gelap. CSP mengizinkan
 * skrip inline (src/lib/security-headers.ts, script-src 'unsafe-inline').
 */
export const KUNCI_TEMA = "tema";

export type Tema = "terang" | "gelap";

export const SKRIP_TEMA = `(function(){try{var t=localStorage.getItem("${KUNCI_TEMA}");var d=t==="gelap"||(t!=="terang"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}})()`;

export function temaTersimpan(): Tema | null {
  try {
    const t = localStorage.getItem(KUNCI_TEMA);
    return t === "terang" || t === "gelap" ? t : null;
  } catch {
    return null;
  }
}

export function sistemGelap(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Tema yang berlaku: pilihan tersimpan, atau pengaturan sistem. */
export function temaBerlaku(): Tema {
  return temaTersimpan() ?? (sistemGelap() ? "gelap" : "terang");
}

export function terapkanTema(tema: Tema) {
  const e = document.documentElement;
  e.classList.toggle("dark", tema === "gelap");
  e.style.colorScheme = tema === "gelap" ? "dark" : "light";
}

export function simpanTema(tema: Tema) {
  try {
    localStorage.setItem(KUNCI_TEMA, tema);
  } catch {
    // Mode privat atau penyimpanan diblokir: tema tetap berganti untuk
    // halaman ini, hanya tidak diingat.
  }
}
