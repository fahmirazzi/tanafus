import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { Kaligrafi } from "@/components/landing/kaligrafi";
import {
  Halaman,
  HurufArab,
  judulBagian,
  Tekanan,
  TombolMulai,
  tautan,
} from "@/components/landing/kerangka";
import { HarakatMerah } from "@/components/tentang/harakat-merah";
import { TitikPemandu } from "@/components/tentang/titik-pemandu";

/**
 * Halaman Tentang (v2, 2026-09-30): satu cerita yang dipandu satu titik merah.
 *
 * Alurnya: tulisan tanpa harakat → titik merah Abu al-Aswad → mushaf asli
 * yang masih bisa dilihat → titik menjadi garis (al-Khalil) → nama Tanafus →
 * ajakan. <TitikPemandu> menggerakkan satu titik merah dari halte ke halte
 * (elemen `data-halte`, urut sesuai DOM); lihat komponennya untuk cara kerja.
 *
 * Setiap klaim bersumber (lihat "Rujukan" dan docs/15, docs/14 pembaruan 9):
 * - QS. Al-Muthaffifin 1 dan 26: teks & terjemahan Kemenag via quran.nu.or.id.
 * - nafīs: Lisān al-‘Arab, entri نفس.
 * - Abu al-Aswad (w. 69 H / 688 M), posisi titik, riwayat salah baca QS.
 *   At-Taubah: 3: Wikipedia, islamiccenter.org, tafsiralquran.id.
 * - al-Khalil bin Ahmad al-Farahidi (w. 786 M): Wikipedia.
 * - Foto mushaf: The Metropolitan Museum of Art, Open Access (domain publik),
 *   37.30 dan 62.152.2, Rogers Fund.
 * Makna "dua titik" sengaja TIDAK ditulis: sumber berbeda (tanwin atau sukun).
 * Demonstrasi titik hanya memakai huruf mim, bukan kata dari ayat (keputusan
 * owner 2026-09-30).
 */
export const metadata: Metadata = {
  title: "Tentang: Kisah Titik Merah dan Arti Nama Tanafus",
  description:
    "Dari mushaf tanpa harakat, titik merah Abu al-Aswad ad-Du'ali, sampai tanda harakat al-Khalil. Kisah di balik logo dan nama Tanafus, dari QS. Al-Muthaffifin ayat 26.",
  alternates: { canonical: "/tentang" },
};

const bagian = "relative isolate";
const alinea = "text-lg leading-relaxed text-ld-muted md:text-xl";
const penanda = "text-sm font-semibold tracking-wide text-ld-muted";

/** Satu tulisan, banyak bacaan. Makna dicek di kamus Arab-Indonesia umum. */
const BACAAN_ALM = [
  { teks: "عِلْم", latin: "‘ilm", arti: "ilmu" },
  { teks: "عَلَم", latin: "‘alam", arti: "bendera, tanda" },
  // Bukan عَلَّمَ ('allama): tasydid mengubah bentuk sambungan huruf, jadi
  // lapisan merah HarakatMerah tidak lagi tertutup rapat dan menyembul.
  { teks: "عَلِمَ", latin: "‘alima", arti: "mengetahui" },
  { teks: "عُلِمَ", latin: "‘ulima", arti: "diketahui" },
];

/**
 * Tiga letak titik Abu al-Aswad pada mim di awal kata (مـــ).
 *
 * Kenapa mim: titik di atas, di bawah, atau di depannya tidak mengubahnya
 * menjadi huruf lain (titik di atas د terbaca ذ, di bawah ح terbaca ج).
 * Kenapa bentuk awal dengan tatwil: ekor م tunggal turun jauh di bawah garis
 * dasar, dan titik "bawah" jatuh di ekornya.
 *
 * Posisi DIUKUR (Amiri, canvas.measureText, 2026-09-29) dalam em, untuk
 * leading-none: pojok kiri atas titik 0,13 em. "Di depan": tulisan Arab
 * berjalan dari kanan ke kiri, jadi "depan" berada di sisi kiri kepala mim.
 */
const LETAK_TITIK = [
  {
    id: "letak-fathah",
    letak: "Di atas huruf",
    tanda: "fathah",
    bunyi: "ma",
    kelas: "left-[0.695em] top-[0.2em]",
    isi: "Titik di atas huruf dibaca dengan bunyi a. Mim bertitik di atas dibaca ma.",
  },
  {
    id: "letak-kasrah",
    letak: "Di bawah huruf",
    tanda: "kasrah",
    bunyi: "mi",
    kelas: "left-[0.695em] top-[0.86em]",
    isi: "Titik di bawah huruf dibaca dengan bunyi i. Mim bertitik di bawah dibaca mi.",
  },
  {
    id: "letak-dhammah",
    letak: "Di depan huruf",
    tanda: "dhammah",
    bunyi: "mu",
    kelas: "left-[0.39em] top-[0.43em]",
    isi: "Titik di depan huruf dibaca dengan bunyi u. Tulisan Arab berjalan dari kanan ke kiri, jadi “depan” ada di sisi kiri.",
  },
];

const NILAI = [
  {
    judul: "Berlomba untuk yang berharga",
    isi: (
      <>
        Akar katanya sama dengan <em>nafīs</em>, artinya berharga. Dalam kamus{" "}
        <em>Lisān al-‘Arab</em>, sesuatu disebut <em>nafīs</em> karena ia
        diperlombakan dan diinginkan. Yang kami perlombakan adalah bacaan
        Al-Qur’an yang benar.
      </>
    ),
  },
  {
    judul: "Berlomba menuju, bukan melawan",
    isi: "Balasan dalam ayat ini tidak habis dibagi. Karena itu di Tanafus tidak ada peringkat antarmurid: setiap anak dibandingkan dengan bacaannya sendiri pekan lalu.",
  },
  {
    judul: "Menakar dengan jujur",
    isi: "Surah yang sama dibuka dengan peringatan bagi orang yang curang dalam menakar dan menimbang (ayat 1). Kami memegangnya sebagai pengingat: menilai dengan jujur, dan hanya menagih sesi yang terjadi.",
  },
];

/**
 * Posisi halte nilai. Di layar lebar ketiga kartu sejajar dan menempel
 * (sticky) di dalam panggung setinggi 260vh, jadi rentang gulirnya dibagi
 * dari satu pemicu (panggung): tiap lompatan menempuh setengah layar gulir.
 * Sebelumnya tanpa panggung, tiap lompatan hanya 8% layar dan terasa terlalu
 * cepat. Di ponsel kartu bertumpuk dan tiap kartu memicu sendiri.
 */
const HALTE_NILAI = [
  { tibaMd: "top 45%", berangkatMd: "top 5%" },
  { tibaMd: "top -45%", berangkatMd: "top -75%" },
  { tibaMd: "top -125%", berangkatMd: "top -155%" },
];

const RUJUKAN: React.ReactNode[] = [
  "QS. Al-Muthaffifin ayat 1 dan 26, terjemahan Kementerian Agama RI.",
  <>
    Ibnu Manzhur, <em>Lisān al-‘Arab</em>, entri <HurufArab>نفس</HurufArab>.
  </>,
  "Riwayat tentang Abu al-Aswad ad-Du’ali dalam sejarah penulisan mushaf.",
  "Sejarah tanda harakat oleh al-Khalil bin Ahmad al-Farahidi.",
  <>
    <em>Folio from a Qur’an Manuscript</em>, The Metropolitan Museum of Art,
    New York, nomor 37.30 dan 62.152.2 (Rogers Fund). Open Access, domain
    publik.
  </>,
];

export default function TentangPage() {
  return (
    <Halaman>
      <TitikPemandu />

      {/* ---------------- 1. Pembuka: lingkaran besar ---------------- */}
      <section className={bagian}>
        <div className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-7xl grid-cols-1 items-center gap-12 px-5 pb-20 pt-14 md:grid-cols-12 md:gap-8 md:px-8 md:pb-24 md:pt-10">
          <div className="md:col-span-7">
            <p data-hero data-hero-fade className={penanda}>
              Tentang Tanafus
            </p>
            <h1
              data-hero
              className="mt-5 max-w-[13ch] text-balance text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] md:text-7xl lg:text-[5.5rem]"
            >
              Semua berawal dari satu <Tekanan>titik merah.</Tekanan>
            </h1>
            <p data-hero data-hero-fade className={`mt-8 max-w-[44ch] ${alinea}`}>
              Tanafus Center adalah lembaga tahsin privat online. Nama kami
              diambil dari Al-Qur’an, dan titik merah di logo kami diambil dari
              sejarah mushaf. Keduanya punya cerita.
            </p>
            <p
              data-hero
              data-hero-fade
              className="mt-10 inline-flex items-center gap-2 text-sm font-semibold"
            >
              <ArrowDown aria-hidden="true" className="size-4 animate-bounce motion-reduce:animate-none" />
              Gulir untuk mengikuti titiknya
            </p>
          </div>
          <div className="flex justify-center md:col-span-5 md:justify-end">
            {/* Halte pertama: lingkaran besar. Tanpa JS tampil sebagai
                lingkaran diam; dengan JS titik pemandu mengambil alih. */}
            <span
              data-halte
              data-berangkat="center 38%"
              aria-hidden="true"
              className="block aspect-square w-[min(64vw,340px)] rounded-full bg-ld-red md:w-[min(40vw,440px)]"
            />
          </div>
        </div>
      </section>

      {/* ---------------- 2. Tulisan tanpa harakat ---------------- */}
      <section className={bagian}>
        <Kaligrafi kata="حرف" arti="huruf" posisi="kanan-bawah" />
        <div className="mx-auto max-w-7xl px-5 py-28 md:px-8 md:py-40">
          <div className="grid grid-cols-1 gap-14 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-5">
              <p className={penanda}>Abad pertama Hijriah</p>
              <h2 className={`${judulBagian} mt-5`}>
                Satu tulisan, <Tekanan>banyak bacaan.</Tekanan>
              </h2>
              <div className={`mt-8 max-w-[44ch] space-y-5 ${alinea}`}>
                <p>
                  Tanpa harakat, huruf yang sama bisa dibaca dengan beberapa
                  cara, dan artinya ikut berubah.
                </p>
                <p>
                  Pada masa awal, mushaf ditulis tanpa harakat. Orang Arab
                  membacanya dengan benar karena itu bahasa mereka sehari-hari.
                  Ketika Islam meluas, makin banyak yang membaca tanpa bekal
                  itu, dan kesalahan baca pun terjadi.
                </p>
              </div>
            </div>

            <div className="md:col-span-7">
              {/* Kata tanpa harakat; titik pemandu melayang JAUH di atasnya,
                  seperti mencari tempatnya. Tidak boleh dekat huruf mana pun:
                  titik di atas ع terbaca غ (i'jam), dan di halaman yang
                  mengajarkan arti titik, itu menyesatkan. Posisinya di atas
                  lam (tidak ada huruf lam bertitik), melewati puncak tinta. */}
              <div className="flex justify-center md:justify-end">
                <span
                  lang="ar"
                  aria-label="علم, tanpa harakat"
                  className="relative inline-block font-ld-arabic text-[clamp(7rem,22vw,13rem)] leading-[1.35]"
                >
                  علم
                  <span
                    data-halte
                    aria-hidden="true"
                    className="absolute left-1/2 -top-[0.3em] size-[0.11em] -translate-x-1/2"
                  />
                </span>
              </div>
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {BACAAN_ALM.map((b) => (
                  <li
                    key={b.teks}
                    data-reveal
                    className="flex flex-col items-center rounded-3xl bg-ld-surface px-4 pb-5 pt-3 text-center"
                  >
                    <HarakatMerah teks={b.teks} className="text-5xl leading-[1.6] md:text-6xl" />
                    <span className="mt-1 text-sm font-semibold">{b.latin}</span>
                    <span className="text-sm text-ld-muted">{b.arti}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={`mx-auto mt-24 max-w-3xl space-y-6 md:mt-32 ${alinea}`}>
            <p data-reveal>
              Menurut riwayat yang masyhur, seseorang keliru membaca QS.
              At-Taubah ayat 3. Kata <em>wa rasūluhu</em> dibacanya{" "}
              <em>wa rasūlihi</em>. Satu harakat itu membalik makna: yang
              seharusnya berarti Allah dan Rasul-Nya berlepas diri dari orang
              musyrik, berubah menjadi Allah berlepas diri dari orang musyrik
              dan juga dari Rasul-Nya.
            </p>
            <p data-reveal className="text-balance text-2xl font-bold leading-snug tracking-tight text-ld-ink md:text-3xl">
              Satu harakat bisa membalik makna. Dari sinilah titik merah lahir.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- 3. Titik Abu al-Aswad: adegan menempel ---------------- */}
      <section className={bagian}>
        <Kaligrafi kata="نقطة" arti="titik" posisi="kiri-bawah" />
        <div className="mx-auto max-w-7xl px-5 pt-28 md:px-8 md:pt-40">
          <p className={penanda}>Abu al-Aswad ad-Du’ali, w. 69 H / 688 M</p>
          <h2 className={`${judulBagian} mt-5 max-w-[16ch]`}>
            Titik merah untuk setiap <Tekanan>bunyi.</Tekanan>
          </h2>
          <p className={`mt-8 max-w-[52ch] ${alinea}`}>
            Abu al-Aswad menandai mushaf dengan titik berwarna merah, berbeda
            dari tinta teksnya, supaya titik itu tidak tertukar dengan huruf.
            Letak titik menunjukkan bunyinya.
          </p>

          <div className="relative mt-12 md:mt-4 md:grid md:grid-cols-12 md:gap-10">
            {/* Mim menempel di layar selama tiga langkah di sampingnya
                dibaca; titik pemandu berpindah ke tiap letak. */}
            <div className="sticky top-16 z-0 flex h-[46vh] items-center justify-center bg-ld-paper md:top-0 md:col-span-6 md:col-start-7 md:row-start-1 md:h-dvh md:bg-transparent">
              <span
                aria-hidden="true"
                lang="ar"
                className="relative inline-block font-ld-arabic text-[clamp(9rem,40vw,21rem)] leading-none"
              >
                مـــ
                {LETAK_TITIK.map((t) => (
                  <span
                    key={t.id}
                    data-halte
                    data-picu={`#${t.id}`}
                    className={`absolute size-[0.13em] rounded-full bg-ld-red ${t.kelas}`}
                  />
                ))}
              </span>
            </div>
            <ol className="relative z-10 md:col-span-6 md:col-start-1 md:row-start-1">
              {LETAK_TITIK.map((t, i) => (
                <li
                  key={t.id}
                  id={t.id}
                  className="flex min-h-[70vh] items-end pb-10 md:min-h-dvh md:items-center md:pb-0"
                >
                  <div className="w-full rounded-3xl bg-ld-paper/95 py-4 md:bg-transparent md:py-0">
                    <p className="text-sm font-semibold text-ld-muted">
                      {i + 1} dari {LETAK_TITIK.length}
                    </p>
                    <h3 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
                      {t.letak}: <span className="text-ld-red">{t.tanda}</span>
                    </h3>
                    <p className={`mt-4 max-w-[40ch] ${alinea}`}>{t.isi}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------------- 4. Mushaf asli: foto The Met ---------------- */}
      <section className={bagian}>
        <div className="mx-auto max-w-7xl px-5 py-28 md:px-8 md:py-40">
          <div className="grid grid-cols-1 items-center gap-14 md:grid-cols-12 md:gap-10">
            <div className="md:col-span-5">
              <p className={penanda}>Lebih dari seribu tahun kemudian</p>
              <h2 className={`${judulBagian} mt-5`}>
                Titik itu masih bisa dilihat <Tekanan>hari ini.</Tekanan>
              </h2>
              <p className={`mt-8 max-w-[42ch] ${alinea}`}>
                Lembar mushaf di samping ditulis dengan khat Kufi pada paruh
                pertama abad ke-10. Titik-titik merah di antara hurufnya adalah
                penanda harakat, dengan cara yang dirintis Abu al-Aswad.
              </p>
              <figure data-reveal className="mt-10 max-w-sm">
                <Image
                  src="/tentang/mushaf-met-62-152-2.jpg"
                  alt="Lembar mushaf kecil berkhat Kufi dari abad ke-9, dengan titik-titik merah penanda harakat."
                  width={2646}
                  height={1402}
                  sizes="(min-width: 768px) 24rem, 90vw"
                  className="h-auto w-full rounded-2xl"
                />
                <figcaption className="mt-3 text-sm text-ld-muted">
                  Mushaf seukuran telapak tangan, abad ke-9 (3,8 × 7,3 cm).
                  The Met, 62.152.2.
                </figcaption>
              </figure>
            </div>
            <figure data-reveal className="md:col-span-6 md:col-start-7">
              <div className="relative">
                <Image
                  src="/tentang/mushaf-met-37-30.jpg"
                  alt="Lembar mushaf berkhat Kufi dari paruh pertama abad ke-10, tinta dan emas di atas perkamen, dengan titik-titik merah penanda harakat."
                  width={1356}
                  height={1776}
                  sizes="(min-width: 768px) 45vw, 90vw"
                  className="h-auto w-full rounded-3xl"
                />
                {/* Salah satu titik merah asli di lembar ini (diukur dari
                    piksel foto): cincin penanda, dan halte titik pemandu. */}
                <span
                  aria-hidden="true"
                  className="absolute left-[31.7%] top-[34.4%] aspect-square w-[7%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ld-red"
                />
                <span
                  data-halte
                  aria-hidden="true"
                  className="absolute left-[31.7%] top-[34.4%] aspect-square w-[2.4%] -translate-x-1/2 -translate-y-1/2"
                />
              </div>
              <figcaption className="mt-4 text-sm text-ld-muted">
                Lembar dari mushaf berkhat Kufi, paruh pertama abad ke-10, tinta
                dan emas di atas perkamen. The Metropolitan Museum of Art,
                Rogers Fund, 1937 (37.30). Domain publik.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ---------------- 5. al-Khalil: titik menjadi garis ---------------- */}
      <section className={bagian}>
        <Kaligrafi kata="حركة" arti="harakat" posisi="kanan-bawah" />
        <div className="mx-auto max-w-7xl px-5 py-28 md:px-8 md:py-40">
          <div className="grid grid-cols-1 items-center gap-14 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-6">
              <p className={penanda}>al-Khalil bin Ahmad al-Farahidi, w. 786 M</p>
              <h2 className={`${judulBagian} mt-5`}>
                Dari titik menjadi <Tekanan>garis.</Tekanan>
              </h2>
              <p className={`mt-8 max-w-[44ch] ${alinea}`}>
                Kemudian al-Khalil mengganti titik-titik itu dengan tanda yang
                kita kenal sampai sekarang: fathah, kasrah, dan dhammah.
              </p>
            </div>
            <div className="flex flex-col items-center md:col-span-6">
              <span
                aria-hidden="true"
                lang="ar"
                className="relative inline-block font-ld-arabic text-[clamp(9rem,36vw,18rem)] leading-none"
              >
                مـــ
                {/* Garis fathah di letak titik "di atas" tadi (pusatnya
                    0,76 em / 0,265 em). Titik pemandu memipih menjadi garis. */}
                <span
                  data-halte
                  data-putar="-20"
                  className="absolute left-[0.63em] top-[0.2375em] h-[0.055em] w-[0.26em] rotate-[-20deg] rounded-full bg-ld-red"
                />
              </span>
              <ul className="mt-8 flex gap-3" aria-label="Harakat pada huruf mim">
                {[
                  { teks: "مَـ", nama: "fathah" },
                  { teks: "مِـ", nama: "kasrah" },
                  { teks: "مُـ", nama: "dhammah" },
                ].map((h) => (
                  <li
                    key={h.nama}
                    data-reveal
                    className="flex flex-col items-center rounded-3xl bg-ld-surface px-6 pb-4 pt-2"
                  >
                    <HarakatMerah teks={h.teks} className="text-5xl leading-[1.7]" />
                    <span className="text-sm text-ld-muted">{h.nama}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 6. Nama Tanafus ---------------- */}
      <section className={bagian}>
        <Kaligrafi kata="نفيس" arti="berharga" posisi="kiri-bawah" />
        <div className="mx-auto max-w-7xl px-5 py-28 md:px-8 md:py-40">
          <p className={penanda}>Hari ini</p>
          <h2 className={`${judulBagian} mt-5 max-w-[18ch]`}>
            Dari kisah itulah nama dan titik kami <Tekanan>berasal.</Tekanan>
          </h2>

          <div className="mt-14 grid grid-cols-1 gap-14 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-5">
              <p className={`max-w-[40ch] ${alinea}`}>
                <span className="font-semibold text-ld-ink">Tanafus</span> (
                <HurufArab>تنافس</HurufArab>) artinya saling berlomba. Kata ini
                diambil dari ayat di samping. Titik merah di logo kami diambil
                dari kisah Abu al-Aswad.
              </p>
              <p className={`mt-5 max-w-[40ch] ${alinea}`}>
                Tahsin melanjutkan kerja yang sama: memastikan setiap huruf
                dibaca dengan harakat yang benar.
              </p>
            </div>

            {/* Teks & terjemahan Kemenag, dicek via quran.nu.or.id. Kata
                "falyatanafas" dibungkus utuh (tidak memutus sambungan huruf);
                titik pemandu memanjang menjadi garis bawahnya. */}
            <figure data-reveal className="md:col-span-7">
              <blockquote>
                <p
                  lang="ar"
                  dir="rtl"
                  className="font-ld-arabic text-[1.9rem] leading-[2.2] md:text-[2.6rem]"
                >
                  خِتٰمُهٗ مِسْكٌ ۗ وَفِيْ ذٰلِكَ{" "}
                  <span className="relative">
                    فَلْيَتَنَافَسِ
                    <span
                      data-halte
                      data-berangkat="center 36%"
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-[0.14em] h-[0.09em] rounded-full bg-ld-red"
                    />
                  </span>{" "}
                  الْمُتَنٰفِسُوْنَ
                </p>
                <p className="mt-5 max-w-[48ch] text-lg leading-relaxed md:text-xl">
                  “Laknya terbuat dari kasturi. Untuk (mendapatkan) yang
                  demikian itu hendaknya orang berlomba-lomba.”
                </p>
              </blockquote>
              <figcaption className="mt-3 text-base text-ld-muted">
                QS. Al-Muthaffifin: 26
              </figcaption>
            </figure>
          </div>

          {/* Panggung: di layar lebar kartu menempel di tengah layar selama
              titik melompat dari kartu ke kartu. */}
          <div id="panggung-nilai" className="mt-24 md:mt-40 md:h-[260vh]">
            <ul className="grid grid-cols-1 gap-8 md:sticky md:top-[26vh] md:grid-cols-3 md:gap-6">
              {NILAI.map((n, i) => (
                <li
                  key={n.judul}
                  id={`nilai-${i}`}
                  data-reveal
                  data-sorot
                  className="relative rounded-3xl border-2 border-ld-line bg-ld-surface p-7 transition-colors duration-500 data-disinggahi:border-ld-red md:p-8"
                >
                  {/* Titik di garis atas kartu: titik pemandu melompat dari
                      kartu ke kartu, seperti berlomba; kartu yang sedang
                      disinggahi garisnya memerah. */}
                  <span
                    data-halte
                    data-picu={`#nilai-${i}`}
                    data-picu-md="#panggung-nilai"
                    data-tiba-md={HALTE_NILAI[i].tibaMd}
                    data-berangkat-md={HALTE_NILAI[i].berangkatMd}
                    aria-hidden="true"
                    className="absolute -top-[9px] left-7 size-4 rounded-full bg-ld-red md:left-8"
                  />
                  <h3 className="text-2xl font-bold tracking-tight">{n.judul}</h3>
                  <p className="mt-3 text-lg leading-relaxed text-ld-muted">{n.isi}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------- 7. Ajakan: titik tenggelam ke blok merah ---------------- */}
      <section data-cta-akhir className="relative isolate px-3 pb-3 md:px-4 md:pb-4">
        {/* Halte terakhir: tepat di atas tepi atas blok. Titik memantul sekali
            di sini, lalu tenggelam; blok yang tadinya agak transparan menjadi
            penuh (titik-pemandu.tsx). Tanpa JS blok langsung penuh. */}
        <span
          data-halte
          data-tenggelam
          data-tiba="center 62%"
          aria-hidden="true"
          className="absolute left-1/2 top-0 z-10 size-4 -translate-x-1/2 -translate-y-full"
        />
        <div
          data-blok-tenggelam
          className="relative isolate overflow-clip rounded-3xl bg-ld-red px-7 py-24 text-ld-on-red md:px-16 md:py-32"
        >
          <Kaligrafi
            kata="ابدأ"
            arti="mulailah"
            posisi="kanan-tengah"
            nada="merah"
            className="text-[clamp(9rem,26vw,24rem)]"
          />
          <div className="mx-auto max-w-7xl">
            <h2 className="max-w-[14ch] text-balance text-5xl font-bold leading-[1.04] tracking-[-0.04em] md:text-7xl">
              Berlomba menuju bacaan{" "}
              <Tekanan nada="tinta">terbaik.</Tekanan>
            </h2>
            <p className="mt-8 max-w-[44ch] text-lg leading-relaxed opacity-90 md:text-xl">
              Jawab beberapa pertanyaan singkat tentang bacaan anak Anda. Kami
              bantu carikan guru dan jadwal yang cocok.
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
              <TombolMulai lokasi="tentang-penutup" className="!bg-ld-paper !text-ld-ink" />
              <Link
                href="/"
                className={`${tautan} font-semibold [--tautan-aktif:currentColor] [--tautan-garis:color-mix(in_oklab,currentColor_40%,transparent)]`}
              >
                Kembali ke beranda
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Rujukan ---------------- */}
      <section className="mx-auto max-w-7xl px-5 pt-12 md:px-8">
        <h2 className="text-sm font-semibold text-ld-ink">Rujukan</h2>
        <ul className="mt-3 space-y-1 text-sm text-ld-muted">
          {RUJUKAN.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>
    </Halaman>
  );
}
