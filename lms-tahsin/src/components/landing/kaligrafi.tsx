/**
 * Kaligrafi dekoratif besar dan transparan di latar sebuah bagian.
 *
 * Teks vektor (font Aref Ruqaa), bukan path SVG buatan tangan: kaligrafi yang
 * digambar manual akan salah bentuk. Tetap tajam di ukuran berapa pun.
 *
 * Aturan pemakaian:
 * - Hanya kata biasa yang berkaitan dengan isi bagian. TIDAK PERNAH ayat
 *   Al-Qur'an atau lafaz Allah: teks suci yang dijadikan latar tipis dan terus
 *   tertimpa guliran tidak pantas.
 * - aria-hidden: dekorasi, bukan isi. Pembaca layar tidak membacanya.
 * - Induknya `relative isolate`, TANPA overflow-clip: kaligrafi sengaja
 *   menjulur ke bagian berikutnya supaya halaman terasa bersambung. Bagian
 *   berikutnya digambar setelahnya, jadi isinya tetap di atas kaligrafi.
 *   Kliping horizontal cukup dari `overflow-x-clip` di pembungkus halaman.
 * - Jangan di bagian terakhir halaman: yang menjulur melewati dasar dokumen
 *   menambah ruang gulir kosong.
 * - `data-decor`: digeser pelan saat digulir (motion-root.tsx), kecuali
 *   pengguna meminta gerak dikurangi.
 */

const POSISI = {
  // "-bawah": menjulur hampir separuh tinggi huruf ke bagian berikutnya.
  "kiri-bawah": "-bottom-[0.42em] -left-[0.05em]",
  "kanan-atas": "-top-[0.2em] -right-[0.06em]",
  "kanan-bawah": "-bottom-[0.42em] -right-[0.03em]",
  "kiri-atas": "-top-[0.2em] -left-[0.08em]",
  // Untuk blok pendek (penutup merah): kata utuh terlihat, tidak terpotong.
  "kanan-tengah": "top-1/2 -translate-y-1/2 -right-[0.02em]",
} as const;

export function Kaligrafi({
  kata,
  arti,
  posisi,
  nada = "tinta",
  className = "",
}: {
  kata: string;
  /** Arti kata. Hanya untuk dokumentasi kode, tidak dirender. */
  arti: string;
  posisi: keyof typeof POSISI;
  /** "tinta" untuk latar terang/gelap biasa, "merah" untuk di atas blok merah. */
  nada?: "tinta" | "merah";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-decor
      data-arti={arti}
      lang="ar"
      dir="rtl"
      className={`pointer-events-none absolute -z-10 select-none whitespace-nowrap font-ld-decor leading-none ${
        nada === "merah" ? "text-ld-on-red opacity-[0.12]" : "text-ld-ink opacity-[0.055]"
      } ${className.includes("text-[") ? "" : "text-[clamp(11rem,34vw,32rem)]"} ${POSISI[posisi]} ${className}`}
    >
      {kata}
    </span>
  );
}
