/**
 * Kelas gaya bersama halaman publik. Modul murni supaya bisa dipakai
 * komponen server (kerangka.tsx) dan client (form /onboarding) tanpa ikut
 * menarik font atau MotionRoot.
 *
 * Sistem sudut: tombol = pill, panel besar = rounded-3xl, bingkai di dalam
 * panel = rounded-2xl.
 */
export const tombolUtama =
  "group/tombol inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-ld-red px-7 py-3.5 text-base font-semibold text-ld-on-red transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ld-ink disabled:pointer-events-none disabled:opacity-40";

/** Panah tombol: bergeser ke arah tujuannya saat disorot. */
export const panahTombol =
  "size-[1.1em] shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

/**
 * Tautan teks: garis bawah abu-abu, lalu garis merah menyapu dari kiri saat
 * disorot (kelas `ld-tautan` di globals.css). Warna garis bisa diganti lewat
 * --tautan-garis dan --tautan-aktif.
 */
export const tautan =
  "ld-tautan rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ld-ink";
