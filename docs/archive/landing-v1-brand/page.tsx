import type { Metadata } from "next";
import Link from "next/link";
import { IlustrasiSesi } from "@/components/landing/illustrations";
import { Kutipan } from "@/components/landing/kutipan";

/**
 * Halaman depan publik. Copy-nya direview di docs/13-landing-page-copy.md —
 * ubah di sana dulu, baru di sini.
 *
 * WAJIB sebelum publikasi: setel NEXT_PUBLIC_WHATSAPP_NUMBER (format
 * internasional tanpa "+", mis. 6281234567890). Selama kosong, semua CTA
 * WhatsApp dinonaktifkan dan pengunjung diarahkan ke daftar guru — lebih baik
 * daripada menautkan nomor placeholder yang salah.
 */
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

const WHATSAPP_MESSAGE =
  "Assalamu'alaikum, saya ingin bertanya soal tahsin privat di Tanafus Center.";

const whatsappHref = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`
  : null;

const JUDUL = "Tahsin Privat Online untuk Anak dan Dewasa";
const RINGKASAN =
  "Bimbingan tahsin privat online satu guru satu murid. Setiap sesi dinilai empat kriteria dan catatannya terbuka untuk orang tua. Bayar sesi yang terjadi saja.";

export const metadata: Metadata = {
  /**
   * `absolute` karena template "%s · Tanafus Center" di root layout TIDAK
   * berlaku untuk app/page.tsx — segmen yang sama dengan layout itu sendiri.
   * Tanpa ini judul beranda keluar tanpa nama merek sama sekali.
   */
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

/** CTA utama. Satu per layar — lihat docs/11-brand-guidelines.md §11. */
function PrimaryCta({ children }: { children: React.ReactNode }) {
  if (!whatsappHref) {
    return (
      <Link
        href="/instructors"
        className="inline-flex items-center justify-center rounded-md bg-orange-500 px-6 py-3 text-base font-semibold text-plum-950 transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum-900"
      >
        Lihat guru privat
      </Link>
    );
  }

  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics="cta-whatsapp"
      className="inline-flex items-center justify-center rounded-md bg-orange-500 px-6 py-3 text-base font-semibold text-plum-950 transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum-900"
    >
      {children}
    </a>
  );
}

/** Contoh penilaian di hero. Angka ilustratif, bukan data murid. */
const CONTOH_RUBRIK = [
  { nama: "Makharijul huruf", nilai: 78 },
  { nama: "Sifatul huruf", nilai: 71 },
  { nama: "Tajwid", nilai: 84 },
  { nama: "Kelancaran", nilai: 80 },
];

const LANGKAH = [
  {
    judul: "Ceritakan kondisi anak Anda",
    isi: "Umurnya berapa, sudah sampai mana bacaannya, kapan waktu luangnya. Cukup lewat WhatsApp.",
  },
  {
    judul: "Kami carikan gurunya",
    isi: "Kami cocokkan dengan guru yang jamnya bersesuaian, lalu jadwal pekanannya ditetapkan.",
  },
  {
    judul: "Sesi privat online",
    isi: "Satu guru satu murid, 30, 45, atau 60 menit. Tidak ada murid lain di ruangan itu.",
  },
  {
    judul: "Nilai dan catatan masuk hari itu juga",
    isi: "Empat kriteria dinilai, catatan gurunya ditulis, dan koreksi suaranya bisa Anda dengarkan ulang.",
  },
];

const PEMBEDA = [
  {
    judul: "Dinilai, bukan dikira-kira",
    isi: "Makharijul huruf, sifatul huruf, tajwid, kelancaran. Empat kriteria yang sama di setiap sesi, sehingga perkembangannya bisa dilihat sebagai grafik, bukan sebagai kesan.",
  },
  {
    judul: "Bayar sesi yang terjadi saja",
    isi: "Guru berhalangan, sesi diliburkan — tidak ada tagihan, dan jatah Anda tidak hangus. Anak sakit atau sedang bepergian? Jadwalnya dijeda, slotnya tetap milik Anda.",
  },
  {
    judul: "Anda melihat semuanya",
    isi: "Jadwal, nilai, catatan guru, dan tagihan terbuka untuk orang tua. Tidak perlu bertanya untuk tahu.",
  },
  {
    judul: "Guru yang tetap",
    isi: "Anak belajar dengan guru yang sama setiap pekan — bukan siapa pun yang kebetulan sedang kosong.",
  },
];

const KRITERIA = [
  {
    nama: "Makharijul huruf",
    isi: "Tempat keluarnya huruf. Apakah ض benar-benar ض.",
  },
  {
    nama: "Sifatul huruf",
    isi: "Sifat huruf: tebal-tipis, tertahan, berdesis.",
  },
  {
    nama: "Tajwid",
    isi: "Hukum bacaan: panjang-pendek, dengung, waqaf.",
  },
  {
    nama: "Kelancaran",
    isi: "Mengalir tanpa tersendat, tanpa mengorbankan tiga hal di atas.",
  },
];

const TANYA_JAWAB = [
  {
    tanya: "Mengaji kan harus bertatap muka. Apa bisa online?",
    jawab:
      "Tahsin adalah koreksi lisan: guru mendengar, lalu membetulkan. Lewat video satu guru satu murid, guru mendengar satu suara saja — lebih dekat daripada di ruangan berisi lima belas anak yang mengaji bergantian. Yang tidak bisa digantikan memang ada, dan kami tidak mengklaim sebaliknya. Tapi untuk memperbaiki bacaan, telinga yang fokus lebih menentukan daripada jarak.",
  },
  {
    tanya: "Anak saya belum bisa baca Arab sama sekali. Bisa ikut?",
    jawab:
      "Bisa. Guru menetapkan levelnya di awal, dan setiap murid privat berjalan di levelnya sendiri — tidak mengejar kelas mana pun.",
  },
  {
    tanya: "Kalau kami sedang bepergian atau anak sakit?",
    jawab:
      "Jadwalnya dijeda. Selama jeda tidak ada sesi yang dibuat dan tidak ada tagihan yang terbit, sementara slot pekanan Anda tetap tersimpan.",
  },
  {
    tanya: "Untuk dewasa juga?",
    jawab:
      "Ya. Sebagian murid adalah orang dewasa yang sudah bisa membaca tapi ingin memperbaiki tajwidnya tanpa harus mengulang dari kelas anak-anak.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-cream-50 text-plum-700">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6">
        <span className="font-heading text-xl font-semibold text-plum-900">
          Tanafus Center
        </span>
        <Link
          href="/login"
          className="rounded-sm text-sm text-plum-700 underline underline-offset-4 hover:text-plum-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum-900"
        >
          Masuk
        </Link>
      </header>

      <main className="flex-1">
        {/* Hero — headline kiri, contoh penilaian kanan. Kartu itu artefak
            paling khas produk ini dan mengerjakan tugas yang belum bisa
            dikerjakan testimoni. */}
        <section className="mx-auto w-full max-w-5xl px-5 pb-16 pt-8 md:pb-24 md:pt-16">
          <div className="grid items-start gap-12 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
            <div>
              <h1 className="font-heading text-[2rem] font-semibold leading-[1.15] tracking-[-0.02em] text-plum-900 md:text-5xl">
                Bagaimana Anda tahu bacaan anak Anda membaik?
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed">
                Tahsin privat online, satu guru satu murid. Setiap sesi dinilai
                dengan rubrik yang sama — makharijul huruf, sifatul huruf,
                tajwid, kelancaran — dan catatan gurunya bisa Anda buka kapan
                saja.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <PrimaryCta>Tanya lewat WhatsApp</PrimaryCta>
                {/* Tanpa nomor WhatsApp, CTA utama sudah jatuh ke /instructors —
                    tautan sekunder ini akan menggandakannya. */}
                {whatsappHref ? (
                  <Link
                    href="/instructors"
                    className="rounded-sm text-base text-plum-700 underline underline-offset-4 hover:text-plum-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum-900"
                  >
                    Lihat guru privat
                  </Link>
                ) : null}
              </div>
              {/* Baris ini menjual, bukan sekadar keterangan — jadi ukuran
                  body (≥16px), sesuai aturan tipografi di brand guidelines. */}
              <p className="mt-5 text-base text-plum-500">
                Sesi yang tidak terjadi tidak ditagih.
              </p>
            </div>

            <IlustrasiSesi className="w-full" />
          </div>
        </section>

        {/* Masalah */}
        <section className="border-y border-plum-200 bg-cream-100">
          <div className="mx-auto w-full max-w-5xl px-5 py-16 md:py-20">
            <h2 className="max-w-2xl font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-plum-900 md:text-4xl">
              Mengaji rutin, tapi hasilnya tidak pernah tercatat
            </h2>
            <div className="mt-7 max-w-2xl space-y-5 text-lg leading-relaxed">
              <p>
                Anak mengaji setiap pekan. Bulan berganti, juz bertambah, dan
                setiap kali ditanya jawabannya sama: “Alhamdulillah, lancar.”
              </p>
              <p>
                Lancar belum tentu benar. Dan sebagian besar orang tua —
                termasuk yang rajin mengaji sendiri — tidak cukup percaya diri
                untuk menilai makhraj anaknya.
              </p>
              <p className="text-plum-900">
                Ini bukan salah gurunya. Memang tidak ada catatan apa pun yang
                tertinggal dari sebuah sesi ngaji.
              </p>
            </div>
          </div>
        </section>

        {/* Ayat tartil — menjembatani "tidak tercatat" ke "kenapa ketelitian
            bacaan itu penting sejak awal". */}
        <section className="mx-auto w-full max-w-5xl px-5 py-16 md:py-20">
          <Kutipan
            arab="وَرَتِّلِ ٱلْقُرْءَانَ تَرْتِيلًا"
            terjemahan="dan bacalah Al-Qur’an itu dengan tartil."
            rujukan="QS. Al-Muzzammil: 4"
          />
        </section>

        {/* Cara kerja — benar-benar berurutan, jadi penomoran dipakai. */}
        <section className="mx-auto w-full max-w-5xl px-5 py-16 md:py-24">
          <h2 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-plum-900 md:text-4xl">
            Empat langkah, mulai dari satu pesan
          </h2>
          <ol className="mt-10 grid gap-x-10 gap-y-9 md:grid-cols-2">
            {LANGKAH.map((langkah, i) => (
              <li key={langkah.judul} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-50 font-mono text-base text-plum-900"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-heading text-xl font-semibold text-plum-900">
                    {langkah.judul}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed">{langkah.isi}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Pembeda */}
        <section className="border-y border-plum-200 bg-cream-100">
          <div className="mx-auto w-full max-w-5xl px-5 py-16 md:py-24">
            <h2 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-plum-900 md:text-4xl">
              Yang tidak ditinggalkan ngaji biasa
            </h2>
            <div className="mt-10 grid gap-x-10 gap-y-9 md:grid-cols-2">
              {PEMBEDA.map((item) => (
                <div key={item.judul}>
                  <h3 className="font-heading text-xl font-semibold text-plum-900">
                    {item.judul}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed">{item.isi}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Rubrik */}
        <section className="mx-auto w-full max-w-5xl px-5 py-16 md:py-24">
          <h2 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-plum-900 md:text-4xl">
            Empat hal yang dinilai setiap sesi
          </h2>
          <dl className="mt-10 max-w-3xl divide-y divide-plum-200 border-y border-plum-200">
            {KRITERIA.map((k) => (
              <div key={k.nama} className="grid gap-1 py-5 md:grid-cols-3 md:gap-8">
                <dt className="font-heading text-xl font-semibold text-plum-900">
                  {k.nama}
                </dt>
                <dd className="text-base leading-relaxed md:col-span-2">
                  {k.isi}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed">
            Nilainya tersimpan setiap sesi. Setelah beberapa pekan, yang terbaca
            bukan lagi satu angka, tapi arahnya.
          </p>

          {/* Contoh penilaian — sebelumnya di hero, dipindah ke sini karena di
              sinilah pembaca baru saja diberi tahu apa arti keempat angkanya. */}
          <figure className="mt-10 max-w-md rounded-lg border border-plum-200 bg-white p-6">
            <figcaption className="mb-5 text-base text-plum-500">
              Contoh catatan sesi — angka ilustratif, bukan data murid.
            </figcaption>
            <p className="font-heading text-lg font-semibold text-plum-900">
              Sesi ke-12, Selasa 16.00
            </p>
            <dl className="mt-5 space-y-4">
              {CONTOH_RUBRIK.map((baris) => (
                <div key={baris.nama}>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-base">{baris.nama}</dt>
                    <dd className="font-mono text-base text-plum-900">
                      {baris.nilai}
                    </dd>
                  </div>
                  <div
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-plum-100"
                  >
                    <div
                      className="h-full rounded-full bg-orange-500"
                      style={{ width: `${baris.nilai}%` }}
                    />
                  </div>
                </div>
              ))}
            </dl>
            <p className="mt-6 border-t border-plum-200 pt-5 text-base leading-relaxed">
              <span className="text-plum-900">Catatan guru: </span>
              Dengung pada nun sukun sudah konsisten. Pekan depan kita kunci mad
              ’aridh lissukun di waqaf.
            </p>
          </figure>
        </section>

        {/* Biaya — placeholder, lihat docs/13-landing-page-copy.md */}
        <section className="border-y border-plum-200 bg-cream-100">
          <div className="mx-auto w-full max-w-5xl px-5 py-16 md:py-20">
            <h2 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-plum-900 md:text-4xl">
              Biaya
            </h2>
            <div className="mt-7 max-w-2xl space-y-5 text-lg leading-relaxed">
              <p>
                Tarif dihitung per sesi, sesuai durasi. Anda bisa memilih ditagih
                per sesi atau sekali sebulan.
              </p>
              <p className="rounded-md border border-dashed border-plum-300 bg-white px-5 py-4 text-base text-plum-500">
                [TARIF — BELUM DIISI. Angka di prisma/seed.ts adalah data demo,
                bukan harga resmi. Jangan publikasikan halaman ini tanpa
                mengganti bagian ini.]
              </p>
              <p>
                Tidak ada biaya pendaftaran. Tidak ada kontrak tahunan. Sesi yang
                tidak terjadi tidak ditagih.
              </p>
            </div>
          </div>
        </section>

        {/* Tanya jawab */}
        <section className="mx-auto w-full max-w-5xl px-5 py-16 md:py-24">
          <h2 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-plum-900 md:text-4xl">
            Pertanyaan yang sering muncul
          </h2>
          <dl className="mt-10 max-w-3xl space-y-8">
            {TANYA_JAWAB.map((item) => (
              <div key={item.tanya}>
                <dt className="font-heading text-xl font-semibold text-plum-900">
                  {item.tanya}
                </dt>
                <dd className="mt-2 text-base leading-relaxed">{item.jawab}</dd>
              </div>
            ))}
            <div>
              <dt className="font-heading text-xl font-semibold text-plum-900">
                Gurunya siapa?
              </dt>
              <dd className="mt-2 space-y-3 text-base leading-relaxed">
                <p className="rounded-md border border-dashed border-plum-300 bg-white px-5 py-4 text-plum-500">
                  [KREDENSIAL GURU — BELUM DIISI.]
                </p>
                <p>
                  Profil setiap guru bisa dilihat di halaman{" "}
                  <Link
                    href="/instructors"
                    className="rounded-sm underline underline-offset-4 hover:text-plum-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum-900"
                  >
                    guru privat
                  </Link>{" "}
                  sebelum Anda memutuskan.
                </p>
              </dd>
            </div>
            <div>
              <dt className="font-heading text-xl font-semibold text-plum-900">
                Bagaimana sesinya dijalankan?
              </dt>
              <dd className="mt-2 text-base leading-relaxed">
                <p className="rounded-md border border-dashed border-plum-300 bg-white px-5 py-4 text-plum-500">
                  [APLIKASI SESI — BELUM DIISI.]
                </p>
              </dd>
            </div>
          </dl>
        </section>

        {/* Arti nama — ayat asal nama Tanafus. Sumber dan aturan pemakaiannya:
            docs/11-brand-guidelines.md §2 "Makna nama". Teks & terjemahan
            Kemenag, diverifikasi lewat quran.nu.or.id. */}
        <section className="border-t border-plum-200 bg-cream-100">
          <div className="mx-auto w-full max-w-5xl px-5 py-16 md:py-24">
            <h2 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-plum-900 md:text-4xl">
              Arti nama Tanafus
            </h2>
            <div className="mt-12">
              <Kutipan
                arab="خِتٰمُهٗ مِسْكٌ ۗ وَفِيْ ذٰلِكَ فَلْيَتَنَافَسِ الْمُتَنٰفِسُوْنَ"
                terjemahan="Laknya terbuat dari kasturi. Untuk (mendapatkan) yang demikian itu hendaknya orang berlomba-lomba."
                rujukan="QS. Al-Muthaffifin: 26"
              />
            </div>
            <div className="mx-auto mt-12 max-w-2xl space-y-5 text-lg leading-relaxed">
              <p>
                <span className="text-plum-900">Tanafus</span> berarti saling
                berlomba. Dalam bahasa Arab, sesuatu disebut{" "}
                <em>nafīs</em> — berharga — justru karena ia diperlombakan. Yang
                kami perlombakan adalah bacaan Al-Qur’an yang benar.
              </p>
              <p>
                Tapi yang berlomba bukan anak melawan anak. Balasan dalam ayat
                ini tidak habis dibagi; satu orang meraihnya tidak mengurangi
                bagian orang lain. Karena itu tidak ada peringkat di Tanafus.
                Setiap murid hanya dibandingkan dengan dirinya sendiri pekan
                lalu.
              </p>
              <p>
                Surah yang sama dibuka dengan peringatan bagi orang yang curang
                dalam menakar dan menimbang. Kami memegangnya sebagai pengingat:
                menilai dengan jujur, dan tidak menagih sesi yang tidak terjadi.
              </p>
            </div>
          </div>
        </section>

        {/* Penutup */}
        <section className="border-t border-plum-200 bg-cream-50">
          <div className="mx-auto w-full max-w-5xl px-5 py-16 md:py-24">
            <h2 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-plum-900 md:text-4xl">
              Mulai dari satu pesan
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed">
              Ceritakan kondisi bacaan anak Anda. Kami jawab apa adanya —
              termasuk kalau menurut kami yang Anda butuhkan bukan kami.
            </p>
            <div className="mt-8">
              <PrimaryCta>Tanya lewat WhatsApp</PrimaryCta>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-plum-500">
        <p>Tanafus Center — Membina Bacaan Al-Qur’an dengan Terukur</p>
        <Link
          href="/instructors"
          className="rounded-sm underline underline-offset-4 hover:text-plum-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum-900"
        >
          Guru privat
        </Link>
      </footer>
    </div>
  );
}
