import { Amiri, Aref_Ruqaa, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Font halaman depan.
 *
 * Plus Jakarta Sans dirancang Tokotype, foundry Indonesia, untuk identitas
 * kota Jakarta. Italic dimuat untuk kata yang ditekankan di judul hero.
 *
 * Amiri adalah naskh klasik: huruf Arab yang harus jelas bentuknya (huruf
 * hijaiyah di hero, ayat, ﷺ).
 *
 * Aref Ruqaa adalah khat riq'ah, dipilih dari 8 kandidat setelah dirender
 * berdampingan (docs/14-landing-v2.md). Hanya untuk kaligrafi dekoratif besar
 * dan transparan di latar bagian; tidak pernah untuk teks yang harus dibaca.
 */
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-jakarta",
});

export const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
});

export const ruqaa = Aref_Ruqaa({
  subsets: ["arabic"],
  weight: ["700"],
  variable: "--font-ruqaa",
});
