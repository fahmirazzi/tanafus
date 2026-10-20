import type { Metadata } from "next";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { Kaligrafi } from "@/components/landing/kaligrafi";
import {
  Halaman,
  HurufArab,
  judulBagian,
  Tekanan,
  TautanWhatsApp,
  TombolMulai,
  TombolWhatsApp,
  tautan,
} from "@/components/landing/kerangka";
import { CONTOH_JAWABAN, susunBaris } from "@/components/onboarding/pertanyaan";

/**
 * Halaman depan v3 (2026-09-29).
 *
 * Copy: docs/16-landing-v3-copy.md (StoryBrand). Riset yang mendasarinya:
 * docs/15-riset-pasar-dan-positioning.md. Sistem visual: docs/14-landing-v2.md.
 * Makna nama dan kisah titik merah ada di /tentang (src/app/tentang/page.tsx).
 *
 * ⚠️ SEBELUM TAYANG, pastikan benar untuk SEMUA guru: bagian "Guru Tanafus"
 * (tes baca, syahadah Ummi/Tilawati/BNSP, sanad) dan metode Ummi/Tilawati di
 * "Cara kami mengajar". Keduanya rekomendasi riset, belum terverifikasi.
 */
const JUDUL = "Les Tahsin Privat Online untuk Anak dan Dewasa";
const RINGKASAN =
  "Les tahsin privat online. Setiap sesi dinilai guru dengan 4 kriteria, hasilnya bisa dilihat orang tua, dan Anda hanya membayar sesi yang terjadi.";

export const metadata: Metadata = {
  // `absolute`: template root layout tidak berlaku untuk segmen yang sama.
  title: { absolute: `${JUDUL} · Tanafus Center` },
  description: RINGKASAN,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${JUDUL} · Tanafus Center`,
    description: RINGKASAN,
    url: "/",
    type: "website",
  },
};

/**
 * Tinggi batang gelombang suara. Literal, bukan Math.random()/Math.sin() saat
 * render: server dan browser (termasuk Safari) harus menghasilkan markup
 * identik, kalau tidak terjadi hydration mismatch.
 */
const GELOMBANG = [
  0.12, 0.13, 0.18, 0.31, 0.39, 0.4, 0.47, 0.35, 0.46, 0.45, 0.71, 0.63, 0.61,
  0.52, 0.53, 0.81, 0.54, 0.9, 0.65, 0.58, 0.67, 0.72, 0.98, 0.59, 0.81, 0.56,
  0.71, 0.78, 0.8, 0.87, 0.58, 0.53, 0.52, 0.8, 0.67, 0.69, 0.58, 0.41, 0.55,
  0.37, 0.62, 0.39, 0.37, 0.25, 0.26, 0.27, 0.13, 0.12,
];

/**
 * Huruf hijaiyah yang bergantian di hero, beserta label makhraj dan sifatnya
 * yang muncul di sekeliling huruf.
 *
 * Dipilih agar kelima wilayah makhraj terwakili (tenggorokan, lidah, bibir;
 * ghunnah dari rongga hidung) dan tiap huruf punya ciri yang menarik. Sifat
 * yang ditandai "khas" memang hanya dimiliki huruf itu: istithalah (ض),
 * tafasysyi (ش), takrir (ر). Sumber: docs/14-landing-v2.md, pembaruan (4).
 *
 * Label pertama selalu makhraj (tempat keluar huruf), sisanya sifat. Letak
 * label dihitung dari batas tinta huruf saat berjalan (motion-root.tsx), jadi
 * label hanya menyentuh sudut huruf dan tidak pernah keluar kolom. Tanpa JS
 * label tidak ditampilkan.
 * Letak titik merah DIUKUR saat berjalan dari batas tinta glifnya
 * (motion-root.tsx). TITIK_AWAL hanya dipakai tanpa JS atau saat gerak
 * dikurangi, ketika hanya huruf pertama (dan labelnya) yang tampil.
 */
type Label = { arab: string; latin: string };
const HURUF: { huruf: string; label: Label[] }[] = [
  {
    huruf: "ض",
    label: [
      { arab: "حافة اللسان", latin: "Hafatul Lisan" },
      { arab: "استطالة", latin: "Istithalah" },
      { arab: "إطباق", latin: "Ithbaq" },
    ],
  },
  {
    huruf: "ح",
    label: [
      { arab: "وسط الحلق", latin: "Wasathul Halq" },
      { arab: "همس", latin: "Hams" },
    ],
  },
  {
    huruf: "ع",
    label: [
      { arab: "وسط الحلق", latin: "Wasathul Halq" },
      { arab: "توسط", latin: "Tawassuth" },
    ],
  },
  {
    huruf: "ق",
    label: [
      { arab: "أقصى اللسان", latin: "Aqshal Lisan" },
      { arab: "قلقلة", latin: "Qalqalah" },
      { arab: "استعلاء", latin: "Isti'la" },
    ],
  },
  {
    huruf: "ش",
    label: [
      { arab: "وسط اللسان", latin: "Wasathul Lisan" },
      { arab: "تفشي", latin: "Tafasysyi" },
    ],
  },
  {
    huruf: "ر",
    label: [
      { arab: "طرف اللسان", latin: "Tharaful Lisan" },
      { arab: "تكرير", latin: "Takrir" },
    ],
  },
  {
    huruf: "ص",
    label: [
      { arab: "طرف اللسان", latin: "Tharaful Lisan" },
      { arab: "صفير", latin: "Shafir" },
    ],
  },
  {
    huruf: "ظ",
    label: [
      { arab: "طرف اللسان", latin: "Tharaful Lisan" },
      { arab: "إطباق", latin: "Ithbaq" },
    ],
  },
  {
    huruf: "ط",
    label: [
      { arab: "طرف اللسان", latin: "Tharaful Lisan" },
      { arab: "قلقلة", latin: "Qalqalah" },
      { arab: "إطباق", latin: "Ithbaq" },
    ],
  },
  {
    huruf: "م",
    label: [
      { arab: "الشفتان", latin: "Asy-Syafatain" },
      { arab: "غنة", latin: "Ghunnah" },
    ],
  },
];

const TITIK_AWAL = { x: 104, y: 13 };

/** Satu baris judul hero di dalam mask; animasinya naik dari bawah mask. */
function BarisJudul({ children }: { children: React.ReactNode }) {
  return (
    // Padding bawah memberi ruang ekor huruf (p, y, g): mask memakai
    // overflow: clip, dan tanpa ini ekornya terpotong rata.
    <span className="-mb-[0.12em] block overflow-clip pb-[0.12em]">
      <span data-hero-line className="block text-balance">
        {children}
      </span>
    </span>
  );
}

const MASALAH = [
  "Tidak tahu sejauh mana kemajuan bacaan anak.",
  "Sulit menilai sendiri apakah makhraj dan tajwidnya sudah tepat.",
  "Khawatir paket les hangus saat anak sakit atau guru berhalangan.",
];

/** Contoh laporan: angka ilustratif (skala 0-100 sesuai GradeCriterion). */
const CONTOH_NILAI = [
  { nama: "Makhraj", nilai: 78 },
  { nama: "Sifat huruf", nilai: 71 },
  { nama: "Tajwid", nilai: 84 },
  { nama: "Kelancaran", nilai: 80 },
];

/** `isi` boleh JSX: ﷺ harus memakai font Arab (lihat HurufArab). */
const SYARAT_GURU: { judul: string; isi: React.ReactNode }[] = [
  {
    judul: "Lulus tes baca Tanafus",
    isi: "Bacaan guru dinilai dengan empat kriteria yang sama seperti murid, dan diuji ulang secara berkala.",
  },
  {
    judul: "Bersertifikat",
    isi: "Memiliki syahadah (sertifikat mengajar) metode Ummi atau Tilawati, atau sertifikat kompetensi dari BNSP, lembaga sertifikasi resmi negara.",
  },
  {
    judul: "Bersanad untuk kelas lanjutan",
    isi: (
      <>
        Untuk dewasa dan tahsin tingkat lanjut, kami utamakan guru bersanad:
        bacaannya bersambung dari guru ke guru hingga Rasulullah{" "}
        <HurufArab>ﷺ</HurufArab>.
      </>
    ),
  },
];

const LANGKAH = [
  {
    judul: "Jawab beberapa pertanyaan singkat.",
    isi: "Siapa yang belajar, sampai mana bacaannya, dan kapan waktunya. Jawaban Anda tersusun menjadi pesan WhatsApp untuk kami.",
    latar: "bg-ld-surface text-ld-ink",
    visual: "pesan",
  },
  {
    judul: "Kenalan dengan guru.",
    isi: "Guru mendengar bacaan anak dan menentukan levelnya. Jadwal pekanan disepakati bersama.",
    latar: "bg-ld-ink text-ld-paper",
    visual: "foto",
  },
  {
    judul: "Belajar dan pantau kemajuan.",
    isi: "Setelah setiap sesi, nilai dan catatan guru langsung bisa Anda lihat.",
    latar: "bg-ld-red text-ld-on-red",
    visual: "catatan",
  },
] as const;

const TANYA = [
  {
    t: "Belajar ngaji online, apa bisa efektif?",
    j: "Bisa. Dalam sesi privat, guru hanya mendengar satu suara, dan gerak bibir guru terlihat jelas di kamera. Anak menirukan, guru langsung membetulkan.",
  },
  {
    t: "Anak saya belum bisa membaca huruf Arab. Bisa ikut?",
    j: "Bisa. Guru menentukan level di sesi perkenalan, lalu anak belajar dari dasar sesuai kemampuannya.",
  },
  {
    t: "Bagaimana jika sesi batal?",
    j: "Jika guru berhalangan, sesi tidak ditagih. Jika anak sakit atau liburan, jadwal bisa dijeda. Tidak ada sesi yang hangus.",
  },
  {
    t: "Untuk orang dewasa juga?",
    j: "Ya. Kelas dewasa cocok untuk yang sudah bisa membaca dan ingin memperbaiki tajwid.",
  },
  {
    t: "Berapa biayanya?",
    j: "Dihitung per sesi sesuai durasi: 30, 45, atau 60 menit. Anda bisa bayar per sesi atau sekali sebulan. Tarif lengkap kami kirim lewat WhatsApp.",
  },
];

/**
 * Setiap bagian `relative isolate` TANPA overflow-clip: kaligrafinya menjulur
 * ke bagian berikutnya, berselang kiri dan kanan, supaya halaman terasa
 * bersambung.
 */
const bagian = "relative isolate";

export default function LandingPage() {
  return (
    <Halaman>
      {/* ---------------- 1. Hero ---------------- */}
      <section className="relative isolate">
        <Kaligrafi
          kata="تنافس"
          arti="saling berlomba, asal nama Tanafus"
          posisi="kiri-bawah"
        />
        <div className="mx-auto grid min-h-[calc(100dvh-72px)] max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-16 pt-10 md:grid-cols-12 md:gap-6 md:px-8 md:pt-14">
          <div className="md:col-span-8">
            {/* Baris ditulis manual (bukan SplitText): letak patahnya pasti,
                dan titik penekanan di baris terakhir tidak terpotong mask. */}
            <h1
              data-hero
              className="text-[2.35rem] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-6xl md:text-[3.25rem] lg:text-[4rem] xl:text-[4.75rem]"
            >
              <BarisJudul>Pastikan bacaan</BarisJudul>
              <BarisJudul>Al-Qur’an anak Anda</BarisJudul>
              <span className="block pt-[0.04em]">
                <Tekanan>benar.</Tekanan>
              </span>
            </h1>
            <p
              data-hero
              data-hero-fade
              className="mt-8 max-w-[40ch] text-lg leading-relaxed text-ld-muted md:text-xl"
            >
              Les tahsin privat online. Setiap sesi dinilai guru, hasilnya bisa
              Anda lihat, dan Anda hanya membayar sesi yang terjadi.
            </p>
            <div
              data-hero
              data-hero-fade
              className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5"
            >
              <TombolMulai lokasi="hero" />
              <TautanWhatsApp lokasi="hero" />
            </div>
          </div>

          {/* Huruf hijaiyah bergantian + titik merah + gelombang suara.
              Loop-nya di motion-root.tsx. Tanpa JS atau dengan gerak
              dikurangi: hanya huruf pertama, diam. */}
          <div
            aria-hidden="true"
            className="relative flex flex-col items-center md:col-span-4"
          >
            <div data-hero data-hero-letter className="relative grid">
              {HURUF.map((h, i) => (
                <span
                  key={h.huruf}
                  lang="ar"
                  data-huruf
                  // leading 1.45: ekor huruf seperti ح turun jauh di bawah
                  // garis dasar; dengan leading rapat, ekornya menabrak
                  // gelombang suara di bawahnya.
                  className="col-start-1 row-start-1 block text-center font-ld-arabic text-[clamp(8rem,16vw,13.5rem)] leading-[1.45] text-ld-ink"
                  style={i === 0 ? undefined : { opacity: 0 }}
                >
                  {h.huruf}
                </span>
              ))}
              {/* Label makhraj dan sifat, satu kelompok per huruf. */}
              {HURUF.map((h) => (
                <div key={`label-${h.huruf}`} data-label-huruf>
                  {h.label.map((l, j) => (
                    <span
                      key={l.latin}
                      data-label
                      data-slot={j}
                      // Kartu: nama Arab di atas, Latin di bawahnya.
                      // Warna dari token --ld-kartu-* (globals.css): putih
                      // bergaris merah di mode terang, merah tua di gelap.
                      className="absolute left-0 top-0 z-10 flex flex-col items-center gap-1.5 whitespace-nowrap rounded-2xl border-[1.5px] border-ld-kartu-garis bg-ld-kartu-latar px-4 pb-2.5 pt-3 opacity-0"
                    >
                      <span
                        lang="ar"
                        dir="rtl"
                        className="font-ld-arabic text-xl leading-none text-ld-kartu-arab md:text-2xl"
                      >
                        {l.arab}
                      </span>
                      <span className="text-[11px] font-medium tracking-wide text-ld-kartu-latin md:text-xs">
                        {l.latin}
                      </span>
                    </span>
                  ))}
                </div>
              ))}
              <span
                data-hero-dot
                className="absolute z-20 size-[clamp(1.2rem,2.1vw,1.9rem)] -translate-x-1/2 rounded-full bg-ld-red"
                style={{ left: `${TITIK_AWAL.x}%`, top: `${TITIK_AWAL.y}%` }}
              />
            </div>
            <div
              data-hero
              data-hero-fade
              data-wave
              className="flex h-16 w-full max-w-sm items-center justify-between md:h-20"
            >
              {GELOMBANG.map((h, i) => (
                <span
                  key={i}
                  className="block w-[3px] rounded-full bg-ld-ink/70 will-change-transform"
                  style={
                    {
                      height: `${Math.round(h * 100)}%`,
                      // Jarak ke tengah, untuk jeda transisi warna: merah
                      // menyebar dari tengah ke tepi (globals.css).
                      "--jarak": Math.abs(i - (GELOMBANG.length - 1) / 2),
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 2. Masalah: pernyataan bertingkat ---------------- */}
      <section className={bagian}>
        <Kaligrafi kata="قراءة" arti="bacaan" posisi="kanan-bawah" />
        <div className="mx-auto max-w-7xl px-5 py-28 md:px-8 md:py-40">
          <h2 className={`${judulBagian} max-w-[20ch]`}>
            Sudah rutin mengaji, tapi apakah bacaannya sudah{" "}
            <Tekanan>benar?</Tekanan>
          </h2>
          <ul className="mt-16 flex flex-col gap-10 md:mt-24 md:gap-14">
            {MASALAH.map((m, i) => (
              <li
                key={m}
                // data-baca: naik per baris, lalu kata demi kata menebal dari
                // abu-abu ke hitam saat digulir, seperti mengikuti bacaan.
                data-baca
                className={`max-w-[24ch] text-balance text-2xl font-semibold leading-[1.18] tracking-[-0.02em] text-ld-muted md:text-4xl ${
                  i % 2 === 1 ? "md:ml-auto md:text-right" : ""
                }`}
              >
                {m}
              </li>
            ))}
          </ul>
          <p
            data-reveal
            className="mt-20 max-w-[36ch] text-balance text-2xl font-bold leading-snug tracking-tight md:mt-28 md:text-3xl"
          >
            Bacaan yang salah lama-lama menjadi kebiasaan.{" "}
            <span className="text-ld-red">
              Makin lama dibiarkan, makin sulit dibetulkan.
            </span>
          </p>
          {/* CTA 1: tepat setelah taruhan dinyatakan, saat rasa perlu paling kuat. */}
          <div data-reveal className="mt-10">
            <TombolMulai lokasi="masalah" />
          </div>
        </div>
      </section>

      {/* ---------------- 3. Yang Anda dapatkan: bento 3 sel ---------------- */}
      <section className={bagian}>
        <Kaligrafi kata="تقدّم" arti="kemajuan" posisi="kiri-bawah" />
        <div className="mx-auto max-w-7xl px-5 py-28 md:px-8 md:py-40">
          <h2 className={`${judulBagian} max-w-[18ch]`}>
            Yang Anda <Tekanan>dapatkan</Tekanan> di Tanafus.
          </h2>

          <div className="mt-14 grid grid-cols-1 gap-4 md:mt-20 md:grid-cols-12 md:gap-5">
            <article
              data-reveal
              className="grid grid-cols-1 gap-10 rounded-3xl bg-ld-surface p-8 md:col-span-7 md:p-12"
            >
              <div>
                <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Kemajuan anak terlihat di setiap sesi
                </h3>
                <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-ld-muted">
                  Setelah setiap sesi, guru menilai empat hal: makhraj, sifat
                  huruf, tajwid, dan kelancaran. Nilai dan catatannya bisa Anda
                  buka kapan saja.
                </p>
              </div>
              {/* Pratinjau laporan: angka besar, tanpa bilah bertrack
                  (aturan design-taste-frontend). */}
              <figure className="rounded-2xl border border-ld-line bg-ld-paper p-6 md:p-7">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                  {CONTOH_NILAI.map((n) => (
                    <div key={n.nama}>
                      <dt className="text-sm text-ld-muted">{n.nama}</dt>
                      <dd
                        data-hitung
                        className="mt-1 text-4xl font-bold tabular-nums tracking-tight"
                      >
                        {n.nilai}
                      </dd>
                    </div>
                  ))}
                </dl>
                <figcaption className="mt-5 border-t border-ld-line pt-4 text-sm text-ld-muted">
                  Contoh laporan satu sesi. Angka ilustratif.
                </figcaption>
              </figure>
            </article>

            <article
              data-reveal
              className="flex flex-col justify-between gap-12 rounded-3xl bg-ld-red p-8 text-ld-on-red md:col-span-5 md:p-12"
            >
              <p className="text-7xl font-bold leading-none tracking-[-0.05em] md:text-8xl">
                {/* Angka turun ke 0, lalu titik jatuh di atasnya (motion-root). */}
                <span className="relative inline-block tabular-nums">
                  <span data-hitung-mundur>0</span>
                  <span
                    aria-hidden="true"
                    data-titik-nol
                    className="absolute -right-[0.2em] top-[0.02em] size-[0.16em] rounded-full bg-current"
                  />
                </span>
                <span className="block pt-3 text-xl font-semibold tracking-tight md:text-2xl">
                  sesi hangus
                </span>
              </p>
              <div>
                <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Tidak ada sesi hangus
                </h3>
                <p className="mt-3 max-w-[36ch] text-lg leading-relaxed opacity-90">
                  Anda membayar per sesi yang benar-benar terjadi. Guru
                  berhalangan, Anda tidak ditagih. Anak sakit atau liburan,
                  jadwal dijeda.
                </p>
              </div>
            </article>

            <article
              data-reveal
              className="flex flex-col gap-6 rounded-3xl bg-ld-ink p-8 text-ld-paper md:col-span-12 md:flex-row md:items-end md:justify-between md:p-12"
            >
              <div>
                <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Guru dengan standar yang jelas
                </h3>
                <p className="mt-3 max-w-[52ch] text-lg leading-relaxed opacity-80">
                  Setiap guru lulus tes baca Tanafus dan memiliki sertifikat
                  mengajar Al-Qur’an.
                </p>
              </div>
              <a
                href="#guru"
                className={`${tautan} shrink-0 font-semibold [--tautan-garis:color-mix(in_oklab,currentColor_35%,transparent)]`}
              >
                Lihat standar guru
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* ---------------- 4. Guru Tanafus: judul kiri, syarat kanan ---------------- */}
      <section id="guru" className={`${bagian} scroll-mt-24`}>
        <Kaligrafi kata="معلّم" arti="guru" posisi="kanan-bawah" />
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-14 px-5 py-28 md:grid-cols-12 md:gap-8 md:px-8 md:py-40">
          <div className="md:col-span-5">
            <h2 className={judulBagian}>
              <Tekanan>Guru</Tekanan> Tanafus
            </h2>
            <p className="mt-7 max-w-[38ch] text-lg leading-relaxed text-ld-muted md:text-xl">
              Kami tahu, mempercayakan bacaan Al-Qur’an anak kepada orang lain
              bukan keputusan kecil. Karena itu setiap guru harus memenuhi
              syarat ini.
            </p>
            {/* CTA 2: setelah kepercayaan pada guru terbangun. */}
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-5">
              <TombolMulai lokasi="guru" />
              <Link
                href="/instructors"
                className={`${tautan} inline-block font-semibold`}
              >
                Lihat kualifikasi dan sanad tiap guru
              </Link>
            </div>
          </div>
          <ul className="md:col-span-7">
            {SYARAT_GURU.map((s) => (
              <li
                key={s.judul}
                data-reveal
                className="flex gap-5 border-t border-ld-line py-8 first:border-t-0 first:pt-0 md:gap-7"
              >
                <span
                  aria-hidden="true"
                  data-centang
                  className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-ld-red text-ld-on-red"
                >
                  <Check className="size-5" strokeWidth={2.5} />
                </span>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                    {s.judul}
                  </h3>
                  <p className="mt-3 max-w-[48ch] text-lg leading-relaxed text-ld-muted">
                    {s.isi}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------- 5. Cara mengajar: kata Arab menempel, teks kanan ---------------- */}
      <section className={bagian}>
        <Kaligrafi
          kata="مشافهة"
          arti="musyafahah, belajar dengan melihat gerak bibir guru"
          posisi="kiri-bawah"
        />
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-5 py-28 md:grid-cols-12 md:gap-8 md:px-8 md:py-40">
          <div className="md:col-span-5">
            <div className="md:sticky md:top-32">
              <h2 className={judulBagian}>
                Cara kami <Tekanan>mengajar</Tekanan>
              </h2>
              <p
                lang="ar"
                dir="rtl"
                aria-hidden="true"
                className="mt-10 text-left font-ld-arabic text-[6.5rem] leading-[1.3] text-ld-red md:text-[9rem]"
              >
                {/* Bayangan pudar + lapisan merah yang "dituliskan" dari kanan
                    ke kiri saat digulir. Tanpa JS lapisan merah utuh. */}
                <span className="relative inline-block">
                  <span className="opacity-15">تَلَقِّي</span>
                  <span data-tulis className="absolute inset-0">
                    تَلَقِّي
                  </span>
                </span>
              </p>
            </div>
          </div>
          <div
            data-talaqqi-poin
            className="flex flex-col gap-16 md:col-span-7 md:gap-20"
          >
            <div data-reveal>
              <h3 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                Talaqqi: guru membacakan, murid menirukan.
              </h3>
              <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-ld-muted md:text-xl">
                Anak melihat gerak bibir guru, lalu menirukan bacaannya. Guru
                mendengarkan dan langsung membetulkan. Ini cara Al-Qur’an
                diajarkan turun-temurun, dari guru ke murid. Lewat kamera, gerak
                bibir guru terlihat dari dekat.
              </p>
            </div>
            <div data-reveal className="border-t border-ld-line pt-10">
              <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                Untuk anak yang baru belajar
              </h3>
              <p className="mt-4 max-w-[48ch] text-lg leading-relaxed text-ld-muted">
                Metode Ummi atau Tilawati, yang banyak dipakai sekolah dan TPQ
                di Indonesia. Kalau sekolah anak sudah memakai salah satunya,
                anak bisa melanjutkan dengan metode yang sama.
              </p>
            </div>
            <div data-reveal className="border-t border-ld-line pt-10">
              <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                Untuk remaja dan dewasa
              </h3>
              <p className="mt-4 max-w-[48ch] text-lg leading-relaxed text-ld-muted">
                Perbaikan tajwid bertahap, mengacu pada kitab Tuhfatul Athfal
                dan Jazariyyah.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 6. Mulai: tumpukan kartu sticky ---------------- */}
      <section className="relative isolate">
        <Kaligrafi kata="بداية" arti="permulaan" posisi="kanan-bawah" />
        <div className="mx-auto max-w-7xl px-5 pb-28 md:px-8 md:pb-40">
          <h2 className={`${judulBagian} max-w-[16ch]`}>
            Mulai dalam <Tekanan>tiga</Tekanan> langkah.
          </h2>

          <ol className="mt-14 flex flex-col gap-6 md:mt-20 md:gap-10">
            {LANGKAH.map((l, i) => (
              <li
                key={l.judul}
                data-stack-card
                // Kartu menempel bertingkat, 18px lebih rendah per kartu,
                // sehingga tepi kartu sebelumnya tetap terlihat.
                style={{ top: `calc(96px + ${i * 18}px)` }}
                className={`${l.latar} grid origin-top grid-cols-1 gap-10 rounded-3xl p-7 md:sticky md:min-h-[58vh] md:grid-cols-2 md:items-center md:gap-12 md:p-14`}
              >
                <div>
                  <p className="text-sm font-semibold opacity-70">
                    {i + 1} dari {LANGKAH.length}
                  </p>
                  <h3 className="mt-3 text-3xl font-bold leading-[1.08] tracking-[-0.025em] md:text-5xl">
                    {l.judul}
                  </h3>
                  <p className="mt-5 max-w-[38ch] text-lg leading-relaxed opacity-80">
                    {l.isi}
                  </p>
                </div>
                <VisualLangkah jenis={l.visual} />
              </li>
            ))}
          </ol>

          <p
            data-reveal
            className="mt-14 text-center text-xl font-bold tracking-tight md:mt-20 md:text-2xl"
          >
            Bayar per sesi. Tidak ada sesi hangus.
          </p>
        </div>
      </section>

      {/* ---------------- 7. Motto: ringkas, kisah lengkapnya di /tentang ---------------- */}
      <section className={bagian}>
        <div className="mx-auto max-w-4xl px-5 py-28 text-center md:px-8 md:py-36">
          {/* data-balap: titik penekanan tidak jatuh dari atas, tetapi
              berlari memantul di atas kata-kata menuju "terbaik." */}
          <p
            data-reveal
            data-balap
            className="text-balance text-4xl font-bold leading-[1.08] tracking-[-0.035em] md:text-7xl"
          >
            Berlomba menuju bacaan <Tekanan>terbaik.</Tekanan>
          </p>
          <p className="mx-auto mt-8 max-w-[46ch] text-lg leading-relaxed text-ld-muted md:text-xl">
            <span className="font-semibold text-ld-ink">Tanafus</span> (
            <HurufArab>تنافس</HurufArab>) artinya saling berlomba, diambil dari
            QS. Al-Muthaffifin ayat 26.
          </p>
          <Link
            href="/tentang"
            className={`${tautan} mt-8 inline-block font-semibold`}
          >
            Kisah di balik nama kami
          </Link>
        </div>
      </section>

      {/* ---------------- 8. Tanya jawab: akordeon ----------------
          Tetap <details> asli (bekerja tanpa JS, bisa dicari dengan Ctrl+F);
          motion-root.tsx hanya menambahkan animasi buka/tutup. */}
      <section className={bagian}>
        <Kaligrafi kata="سؤال" arti="pertanyaan" posisi="kiri-bawah" />
        <div className="mx-auto max-w-3xl px-5 py-28 md:px-8 md:py-40">
          <h2 className={judulBagian}>
            <Tekanan>Pertanyaan</Tekanan> yang sering diajukan
          </h2>
          <div className="mt-14">
            {TANYA.map((q) => (
              <details
                key={q.t}
                data-faq
                className="border-b border-ld-line first:border-t"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-7 text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ld-ink md:text-2xl [&::-webkit-details-marker]:hidden">
                  <span data-faq-tanya>{q.t}</span>
                  <span
                    aria-hidden="true"
                    data-faq-ikon
                    className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ld-line"
                  >
                    <Plus strokeWidth={1.75} className="size-5" />
                  </span>
                </summary>
                <div data-faq-isi className="overflow-hidden">
                  <p className="max-w-[60ch] pb-8 text-lg leading-relaxed text-ld-muted">
                    {q.j}
                  </p>
                </div>
              </details>
            ))}
          </div>
          {/* CTA 4: untuk yang pertanyaannya belum terjawab di atas. */}
          <div className="mt-14 flex flex-col items-start gap-5 rounded-3xl bg-ld-surface p-7 sm:flex-row sm:items-center sm:justify-between md:p-9">
            <p className="text-xl font-semibold tracking-tight md:text-2xl">
              Pertanyaan Anda belum terjawab?
            </p>
            <TombolWhatsApp lokasi="tanya-jawab" />
          </div>
        </div>
      </section>

      {/* ---------------- 9. Penutup: satu blok warna ---------------- */}
      <section
        id="mulai"
        data-cta-akhir
        className="relative isolate px-3 pb-3 md:px-4 md:pb-4"
      >
        <div className="relative isolate overflow-clip rounded-3xl bg-ld-red px-7 py-24 text-ld-on-red md:px-16 md:py-36">
          <Kaligrafi
            kata="ابدأ"
            arti="mulailah"
            posisi="kanan-tengah"
            nada="merah"
            className="text-[clamp(9rem,26vw,24rem)]"
          />
          <div className="mx-auto max-w-7xl">
            <h2 className="max-w-[14ch] text-balance text-5xl font-bold leading-[1.04] tracking-[-0.04em] md:text-7xl">
              Tahu kemajuan bacaan anak,{" "}
              <Tekanan nada="tinta">setiap pekan.</Tekanan>
            </h2>
            <p className="mt-8 max-w-[46ch] text-lg leading-relaxed opacity-90 md:text-xl">
              Jawab beberapa pertanyaan singkat tentang anak Anda. Kami bantu
              carikan guru dan jadwal yang cocok.
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
            <div className="relative inline-flex">
              {/* Di atas blok merah, tombol dibalik: latar paper, teks ink. */}
              <TombolMulai lokasi="penutup" className="!bg-ld-paper !text-ld-ink" />
              {/* Dua cincin riak, sekali saat blok ini terlihat. */}
              {[0, 1].map((k) => (
                <span
                  key={k}
                  aria-hidden="true"
                  data-riak-tombol
                  className="pointer-events-none absolute inset-0 rounded-full border-2 border-ld-paper opacity-0"
                />
              ))}
            </div>
            <TautanWhatsApp
              lokasi="penutup"
              className="[--tautan-aktif:currentColor] [--tautan-garis:color-mix(in_oklab,currentColor_40%,transparent)]"
            />
            </div>
          </div>
        </div>
      </section>
    </Halaman>
  );
}

/** Visual di sisi kanan tiap kartu langkah. Tidak ada tiruan UI aplikasi. */
function VisualLangkah({ jenis }: { jenis: (typeof LANGKAH)[number]["visual"] }) {
  if (jenis === "pesan") {
    // Contoh pesan yang disusun form /onboarding, dari fungsi yang sama
    // dengan yang dipakai form itu (susunBaris), jadi selalu sesuai.
    return (
      <figure
        data-pesan
        className="relative rounded-2xl border border-ld-line bg-ld-paper p-7 md:p-9"
      >
        {/* Tanda "sedang mengetik", hanya tampil sesaat lewat motion-root. */}
        <span
          aria-hidden="true"
          data-mengetik
          className="absolute left-7 top-8 flex gap-1.5 opacity-0 md:left-9 md:top-10"
        >
          {[0, 1, 2].map((k) => (
            <span key={k} className="size-2.5 rounded-full bg-ld-muted" />
          ))}
        </span>
        <blockquote data-pesan-isi className="space-y-1.5 text-lg leading-relaxed md:text-xl">
          {susunBaris(CONTOH_JAWABAN).map((b, i) => (
            <p key={i} className={i === 0 ? "pb-1.5" : undefined}>
              {b}
            </p>
          ))}
        </blockquote>
        <figcaption className="mt-5 text-sm text-ld-muted">
          Contoh pesan dari jawaban form. Nama rekaan.
        </figcaption>
        {/* CTA 3: langkah pertama adalah form ini, jadi tombolnya di sini. */}
        <TombolMulai lokasi="langkah-1" className="mt-6" />
      </figure>
    );
  }
  if (jenis === "foto") {
    // TODO(owner): foto guru Tanafus sungguhan saat sesi, rasio 4:3, dengan
    // izin tertulis keluarga bila wajah anak terlihat. Sengaja bukan foto AI:
    // itu akan menampilkan guru dan murid yang tidak ada.
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl border border-dashed border-ld-paper/35 p-8 text-center text-sm text-ld-paper/70">
        Tempat foto guru Tanafus saat mengajar, 4:3
      </div>
    );
  }
  return (
    <figure className="rounded-2xl bg-ld-paper/12 p-7 md:p-9">
      <blockquote data-catatan className="text-xl leading-relaxed md:text-2xl">
        “Dengung pada nun sukun sudah konsisten. Pekan depan kita latih panjang
        bacaan di akhir ayat.”
      </blockquote>
      <figcaption className="mt-5 text-sm opacity-80">
        Contoh catatan guru setelah sesi.
      </figcaption>
    </figure>
  );
}
