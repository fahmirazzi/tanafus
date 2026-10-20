/**
 * Kata Arab dengan harakat berwarna merah dan huruf berwarna tinta, seperti
 * mushaf bertitik merah Abu al-Aswad.
 *
 * Kenapa dua lapis, bukan <span> merah untuk tiap harakat: memecah satu kata
 * menjadi beberapa elemen bisa memutus penyambungan huruf Arab di sebagian
 * browser. Jadi kata utuh bertanda digambar merah di bawah, lalu kata yang
 * sama TANPA harakat digambar tinta tepat di atasnya. Huruf dasarnya identik
 * (harakat tidak menggeser huruf), sehingga yang tersisa merah hanya
 * harakatnya. Garis tepi tipis pada lapisan tinta menutup pinggiran merah
 * hasil anti-aliasing.
 *
 * Batasan: hanya untuk kata yang bentuk sambungan hurufnya tidak berubah
 * oleh harakat. Tasydid (mis. عَلَّمَ) bisa mengubah bentuknya dan membuat
 * lapisan merah menyembul; periksa hasilnya setiap menambah kata.
 *
 * Pembaca layar hanya membaca teks bertanda satu kali (sr-only).
 */
// Fathatan sampai sukun (U+064B-U+0652) dan alif khanjariyah (U+0670).
const HARAKAT = /[\u064B-\u0652\u0670]/g;

export function HarakatMerah({
  teks,
  className = "",
}: {
  teks: string;
  className?: string;
}) {
  return (
    <span lang="ar" dir="rtl" className={`relative inline-block font-ld-arabic ${className}`}>
      <span aria-hidden="true" className="absolute inset-0 text-ld-red">
        {teks}
      </span>
      <span
        aria-hidden="true"
        className="relative text-ld-ink [-webkit-text-stroke:0.014em_currentColor]"
      >
        {teks.replace(HARAKAT, "")}
      </span>
      <span className="sr-only">{teks}</span>
    </span>
  );
}
