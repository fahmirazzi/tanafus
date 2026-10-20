import type { Metadata } from "next";
import Link from "next/link";
import { Halaman, tautan } from "@/components/landing/kerangka";
import { DELETION_GRACE_DAYS } from "@/lib/account-deletion";
import {
  ISIAN_PEMILIK,
  kebijakanMasihDraf,
  type KunciIsian,
} from "@/lib/kebijakan-privasi";

/**
 * Kebijakan privasi (UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi).
 * Dirujuk kotak persetujuan formulir daftar dan footer halaman publik.
 *
 * Isi halaman ini menjelaskan perilaku aplikasi yang SUDAH ada, dan harus
 * ikut diperbarui bila perilakunya berubah:
 * - Data yang dikumpulkan: validations/auth.ts (registrasi), schema.prisma.
 * - Ekspor: /api/account/export + lib/data-export.ts. Hanya data akun yang
 *   sedang masuk; anak tanpa akun sendiri tidak bisa diekspor orang tuanya.
 * - Hapus akun: lib/account-deletion.ts (tenggang, syarat) dan
 *   lib/account-deletion-executor.ts (apa yang dikosongkan). Permintaan untuk
 *   anak lewat tinjauan admin: /api/account/family-deletion-request.
 * - Jawaban /onboarding tidak disimpan (components/onboarding/pertanyaan.ts).
 *   Rilis B-17 akan menyimpannya; bagian "Yang tidak kami simpan" WAJIB
 *   diubah di PR yang sama.
 *
 * Fakta hukum dan data lembaga TIDAK ditulis di sini: semuanya isian pemilik
 * di lib/kebijakan-privasi.ts. Selama masih ada yang kosong, halaman ini
 * berstatus draf: tampil spanduk draf dan tidak diindeks mesin pencari.
 */
const draf = kebijakanMasihDraf();

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Data apa yang dikumpulkan Tanafus Center, termasuk data anak, untuk apa dipakai, berapa lama disimpan, dan cara mengunduh atau menghapusnya.",
  alternates: { canonical: "/kebijakan-privasi" },
  robots: draf ? { index: false, follow: true } : undefined,
};

const alinea = "text-lg leading-relaxed text-ld-muted";
const daftar = `mt-4 list-disc space-y-2 pl-6 marker:text-ld-red ${alinea}`;
const subjudul = "mt-8 text-xl font-bold tracking-tight text-ld-ink";

/**
 * Nilai isian pemilik, atau penanda yang mencolok selama masih kosong.
 * Penanda sengaja terlihat oleh siapa pun yang membuka halaman: kebijakan
 * dengan lubang tidak boleh terlihat seolah sudah lengkap.
 */
function Isian({ k }: { k: KunciIsian }) {
  const isian = ISIAN_PEMILIK[k];
  if (isian.nilai !== null) return <>{isian.nilai}</>;
  return (
    <mark className="rounded-md border border-dashed border-ld-red bg-ld-red/10 px-1.5 py-0.5 font-semibold text-ld-red [box-decoration-break:clone]">
      [Wajib diisi pemilik: {isian.perlu}]
    </mark>
  );
}

function Bagian({
  id,
  nomor,
  judul,
  children,
}: {
  id: string;
  nomor: number;
  judul: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-ld-line pt-10">
      <h2 className="text-balance text-2xl font-bold tracking-tight md:text-3xl">
        <span className="mr-3 text-ld-red">{nomor}.</span>
        {judul}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const DAFTAR_ISI = [
  { id: "pengendali", judul: "Siapa yang mengelola data Anda" },
  { id: "data", judul: "Data yang kami kumpulkan" },
  { id: "anak", judul: "Data anak" },
  { id: "tujuan", judul: "Untuk apa data dipakai" },
  { id: "pihak-lain", judul: "Siapa saja yang menerima data" },
  { id: "cookie", judul: "Cookie dan penyimpanan di peramban" },
  { id: "masa-simpan", judul: "Berapa lama data disimpan" },
  { id: "hak", judul: "Hak Anda atas data" },
  { id: "keamanan", judul: "Keamanan" },
  { id: "perubahan", judul: "Perubahan kebijakan" },
  { id: "kontak", judul: "Menghubungi kami" },
] as const;

const nomorBagian = (id: (typeof DAFTAR_ISI)[number]["id"]) =>
  DAFTAR_ISI.findIndex((b) => b.id === id) + 1;

export default function KebijakanPrivasiPage() {
  return (
    <Halaman>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-14 md:px-8 md:pb-32 md:pt-20">
        <p data-hero data-hero-fade className="text-sm font-semibold tracking-wide text-ld-muted">
          Tanafus Center
        </p>
        <h1 data-hero className="mt-5 text-balance text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] md:text-6xl">
          Kebijakan privasi
        </h1>
        <p data-hero data-hero-fade className={`mt-8 ${alinea}`}>
          Halaman ini menjelaskan data pribadi apa yang kami kumpulkan saat
          Anda dan anak Anda belajar di Tanafus Center, untuk apa data itu
          dipakai, siapa yang bisa melihatnya, dan bagaimana Anda bisa
          mengunduh atau menghapusnya. Kebijakan ini disusun dengan mengacu
          pada Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data
          Pribadi (UU PDP).
        </p>
        <p className="mt-4 text-base text-ld-muted">
          Berlaku sejak: <Isian k="tanggalBerlaku" />
        </p>

        {draf ? (
          <div
            role="note"
            className="mt-10 rounded-2xl border-2 border-dashed border-ld-red p-6"
          >
            <p className="font-bold text-ld-red">Draf, belum berlaku</p>
            <p className="mt-2 text-base leading-relaxed text-ld-muted">
              Bagian yang bertanda merah belum diisi oleh pengelola lembaga.
              Seluruh teks masih perlu ditinjau sebelum kebijakan ini
              dinyatakan berlaku.
            </p>
          </div>
        ) : null}

        <div className="mt-10 rounded-3xl bg-ld-surface p-7 md:p-8">
          <h2 className="text-lg font-bold">Ringkasnya</h2>
          <ul className={daftar}>
            <li>
              Kami hanya meminta data yang diperlukan untuk menjalankan kelas
              dan tagihan. Kami tidak meminta NIK atau nomor Kartu Keluarga.
            </li>
            <li>
              Data anak didaftarkan dan dikelola oleh orang tua atau wali.
            </li>
            <li>
              Anda bisa mengunduh salinan data Anda kapan saja dari menu{" "}
              <strong className="text-ld-ink">Data &amp; akun</strong>.
            </li>
            <li>
              Anda bisa meminta akun dihapus. Ada masa tenggang{" "}
              {DELETION_GRACE_DAYS} hari untuk berubah pikiran, lalu identitas
              Anda dihapus dari sistem.
            </li>
          </ul>
        </div>

        <nav aria-labelledby="daftar-isi" className="mt-12">
          <h2 id="daftar-isi" className="text-sm font-semibold text-ld-ink">
            Daftar isi
          </h2>
          <ol className="mt-4 grid gap-x-8 gap-y-2 text-base sm:grid-cols-2">
            {DAFTAR_ISI.map((b, i) => (
              <li key={b.id} className="flex gap-2">
                <span className="w-6 shrink-0 text-ld-muted">{i + 1}.</span>
                <a href={`#${b.id}`} className={tautan}>
                  {b.judul}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-14 space-y-14">
          <Bagian id="pengendali" nomor={nomorBagian("pengendali")} judul="Siapa yang mengelola data Anda">
            <p className={alinea}>
              Pengendali data pribadi dalam layanan ini adalah{" "}
              <Isian k="namaPengendali" />, pengelola Tanafus Center, yang
              beralamat di <Isian k="alamat" />.
            </p>
            <p className={`mt-4 ${alinea}`}>
              Petugas pelindungan data pribadi:{" "}
              <Isian k="petugasPelindunganData" />.
            </p>
          </Bagian>

          <Bagian id="data" nomor={nomorBagian("data")} judul="Data yang kami kumpulkan">
            <h3 className={subjudul}>Saat orang tua mendaftar</h3>
            <ul className={daftar}>
              <li>Nama lengkap dan alamat email.</li>
              <li>Nomor HP, bila Anda mengisinya. Kolom ini tidak wajib.</li>
              <li>Hubungan dengan anak: ayah, ibu, atau wali.</li>
              <li>
                Kata sandi. Kami hanya menyimpan bentuk acaknya (hash), bukan
                kata sandi aslinya, sehingga kami pun tidak bisa membacanya.
              </li>
            </ul>

            <h3 className={subjudul}>Data anak yang Anda daftarkan</h3>
            <ul className={daftar}>
              <li>Nama lengkap.</li>
              <li>Jenis kelamin dan tanggal lahir, bila Anda mengisinya.</li>
              <li>Kata sandi, bila Anda membuatkan anak akun sendiri.</li>
            </ul>

            <h3 className={subjudul}>Selama belajar</h3>
            <ul className={daftar}>
              <li>Jadwal dan riwayat sesi, termasuk kehadiran.</li>
              <li>
                Nilai per kriteria bacaan dan catatan guru: kekuatan, bagian
                yang perlu diperbaiki, dan target berikutnya.
              </li>
              <li>Tautan rekaman suara, bila guru menambahkannya ke catatan.</li>
              <li>Hasil penempatan level dan rapor, untuk kelas reguler.</li>
              <li>Permintaan libur beserta alasan yang Anda tulis.</li>
              <li>Notifikasi yang kami kirim kepada Anda.</li>
            </ul>

            <h3 className={subjudul}>Tagihan dan pembayaran</h3>
            <ul className={daftar}>
              <li>Tagihan, jumlah, status pembayaran, dan metode bayar.</li>
              <li>
                Untuk transfer manual: tautan bukti transfer dan nomor
                referensi yang Anda kirim.
              </li>
              <li>
                Untuk pembayaran lewat Midtrans: nomor kartu atau rekening
                Anda masukkan di halaman Midtrans, bukan di aplikasi kami.
                Kami menerima status pembayarannya saja.
              </li>
            </ul>

            <h3 className={subjudul}>Data teknis</h3>
            <ul className={daftar}>
              <li>
                Alamat IP, dipakai sementara untuk membatasi percobaan masuk
                yang berlebihan.
              </li>
              <li>
                Laporan galat aplikasi. Data pribadi disaring dari laporan
                sebelum dikirim.
              </li>
            </ul>

            <h3 className={subjudul}>Yang tidak kami simpan</h3>
            <p className={`mt-4 ${alinea}`}>
              Jawaban di halaman{" "}
              <Link href="/onboarding" className={tautan}>
                Cari guru yang cocok
              </Link>{" "}
              tidak disimpan di sistem kami. Jawaban itu hanya disusun menjadi
              pesan WhatsApp, dan Anda sendiri yang memutuskan untuk
              mengirimnya. Percakapan WhatsApp setelahnya tunduk pada
              kebijakan privasi WhatsApp.
            </p>
          </Bagian>

          <Bagian id="anak" nomor={nomorBagian("anak")} judul="Data anak">
            <p className={alinea}>
              Data anak didaftarkan oleh orang tua atau wali, dan persetujuan
              atas pengelolaannya diberikan oleh orang tua atau wali saat
              mendaftar.
            </p>
            <ul className={daftar}>
              <li>
                Anak yang tidak dibuatkan kata sandi tidak bisa masuk sendiri.
                Perkembangannya dipantau lewat akun orang tua.
              </li>
              <li>
                Data belajar anak hanya bisa dilihat oleh orang tua atau wali
                yang tertaut dengannya, guru yang mengajarnya, dan admin
                lembaga.
              </li>
              <li>
                Tidak ada peringkat antarmurid. Nilai seorang anak tidak
                ditampilkan kepada keluarga lain.
              </li>
            </ul>
          </Bagian>

          <Bagian id="tujuan" nomor={nomorBagian("tujuan")} judul="Untuk apa data dipakai">
            <ul className={daftar}>
              <li>Menyusun jadwal, mencocokkan guru, dan menjalankan sesi.</li>
              <li>
                Mencatat perkembangan bacaan dan melaporkannya kepada orang
                tua.
              </li>
              <li>Membuat tagihan dan mencatat pembayaran.</li>
              <li>
                Mengirim pemberitahuan tentang layanan: pengingat sesi,
                perubahan jadwal, dan tagihan, lewat notifikasi aplikasi dan,
                untuk sebagian pemberitahuan, email.
              </li>
              <li>Menjaga keamanan akun dan memperbaiki galat aplikasi.</li>
            </ul>
            <p className={`mt-4 ${alinea}`}>
              Kami tidak menjual data pribadi dan tidak memakainya untuk iklan.
            </p>
          </Bagian>

          <Bagian id="pihak-lain" nomor={nomorBagian("pihak-lain")} judul="Siapa saja yang menerima data">
            <p className={alinea}>
              Di dalam lembaga, data hanya dibuka sesuai peran: guru melihat
              murid yang diajarnya, orang tua melihat anaknya sendiri, dan
              admin mengelola akun serta tagihan.
            </p>
            <p className={`mt-4 ${alinea}`}>
              Untuk menjalankan aplikasi, kami memakai penyedia layanan yang
              memproses data atas nama kami:
            </p>
            <ul className={daftar}>
              <li>Vercel: menjalankan aplikasi web.</li>
              <li>
                Basis data dan penyimpanan: <Isian k="penyediaBasisData" />.
              </li>
              <li>Resend: mengirim email.</li>
              <li>Midtrans: memproses pembayaran daring.</li>
              <li>Sentry: mencatat galat aplikasi.</li>
              <li>Upstash: membatasi percobaan masuk yang berlebihan.</li>
            </ul>
            <p className={`mt-4 ${alinea}`}>
              <Isian k="transferLuarNegeri" />
            </p>
          </Bagian>

          <Bagian id="cookie" nomor={nomorBagian("cookie")} judul="Cookie dan penyimpanan di peramban">
            <ul className={daftar}>
              <li>
                Cookie sesi, supaya Anda tetap masuk setelah login. Tanpa
                cookie ini Anda tidak bisa masuk ke akun.
              </li>
              <li>
                Pilihan tema terang atau gelap, disimpan di peramban Anda
                sendiri dan tidak dikirim kepada kami.
              </li>
            </ul>
            <p className={`mt-4 ${alinea}`}>
              Kami tidak memasang cookie iklan atau pelacak pihak ketiga.
            </p>
          </Bagian>

          <Bagian id="masa-simpan" nomor={nomorBagian("masa-simpan")} judul="Berapa lama data disimpan">
            <ul className={daftar}>
              <li>Selama akun aktif, data disimpan untuk menjalankan layanan.</li>
              <li>
                Akun yang tidak lagi dipakai: <Isian k="masaSimpanAkunTidakAktif" />.
              </li>
              <li>
                Setelah akun dihapus, identitas pemiliknya dihapus (lihat
                bagian{" "}
                <a href="#hak" className={tautan}>
                  Hak Anda
                </a>
                ). Catatan sesi, nilai, dan keuangan tetap ada tanpa nama,
                sehingga tidak lagi menunjuk kepada Anda.
              </li>
              <li>
                Catatan keuangan tanpa nama: <Isian k="masaSimpanKeuangan" />.
              </li>
            </ul>
          </Bagian>

          <Bagian id="hak" nomor={nomorBagian("hak")} judul="Hak Anda atas data">
            <h3 className={subjudul}>Mengunduh salinan data</h3>
            <p className={`mt-4 ${alinea}`}>
              Setelah masuk, buka menu{" "}
              <strong className="text-ld-ink">Data &amp; akun</strong> lalu
              pilih <strong className="text-ld-ink">Unduh data saya</strong>.
              Anda menerima satu berkas JSON berisi profil, riwayat sesi,
              nilai, catatan guru, tagihan, dan pembayaran milik akun yang
              sedang masuk. Berkas dibuat saat diminta dan tidak disimpan di
              server kami.
            </p>
            <p className={`mt-4 ${alinea}`}>
              Tombol itu hanya memuat data akun yang sedang masuk. Untuk
              salinan data anak, masuklah dengan akun anak bila ia punya akun
              sendiri, atau kirim permintaan ke{" "}
              <Isian k="emailPrivasi" />.
            </p>

            <h3 className={subjudul}>Memperbaiki data</h3>
            <p className={`mt-4 ${alinea}`}>
              Bila ada data yang salah atau tidak lengkap, kirim permintaan ke{" "}
              <Isian k="emailPrivasi" />. Admin lembaga yang memperbaikinya.
            </p>

            <h3 className={subjudul}>Menghapus akun Anda sendiri</h3>
            <ul className={daftar}>
              <li>
                Ajukan dari menu{" "}
                <strong className="text-ld-ink">Data &amp; akun</strong>.
              </li>
              <li>
                Ada masa tenggang {DELETION_GRACE_DAYS} hari. Selama itu
                permintaan bisa dibatalkan dari menu yang sama.
              </li>
              <li>
                Permintaan ditolak bila masih ada tagihan yang belum lunas.
                Selesaikan pembayaran lebih dulu, atau hubungi admin. Untuk
                akun guru, permintaan juga ditolak bila masih ada upah yang
                belum tersalur.
              </li>
            </ul>

            <h3 className={subjudul}>Menghapus akun anak</h3>
            <ul className={daftar}>
              <li>
                Orang tua atau wali mengajukannya dari menu{" "}
                <strong className="text-ld-ink">Data &amp; akun</strong>.
              </li>
              <li>
                Admin meninjau permintaan itu lebih dulu dan bisa menyetujui
                atau menolaknya. Masa tenggang {DELETION_GRACE_DAYS} hari baru
                berjalan setelah admin menyetujuinya.
              </li>
              <li>
                Syarat tagihan yang sama berlaku: tagihan atas nama anak harus
                lunas lebih dulu.
              </li>
              <li>
                Permintaan bisa ditarik kembali selama akun anak belum
                dihapus.
              </li>
            </ul>

            <h3 className={subjudul}>Yang terjadi saat akun dihapus</h3>
            <p className={`mt-4 ${alinea}`}>
              Setelah masa tenggang berakhir, sistem menghapus identitas
              pemilik akun:
            </p>
            <ul className={daftar}>
              <li>
                Nama diganti menjadi “Pengguna dihapus”. Email, nomor HP,
                foto, alamat, tanggal lahir, dan jenis kelamin dikosongkan.
              </li>
              <li>Akun tidak bisa lagi dipakai untuk masuk.</li>
              <li>
                Catatan guru, tautan rekaman suara, dan alasan libur yang
                menyangkut akun itu dikosongkan.
              </li>
              <li>Jadwal sesi rutin dihentikan.</li>
            </ul>
            <p className={`mt-4 ${alinea}`}>
              Catatan keuangan (tagihan dan pembayaran) tetap tersimpan tanpa
              nama karena lembaga wajib menjaga pembukuannya. Setelah akun
              dihapus, prosesnya tidak bisa dibatalkan.
            </p>

            <h3 className={subjudul}>Menarik persetujuan dan mengajukan keberatan</h3>
            <p className={`mt-4 ${alinea}`}>
              Anda bisa menarik persetujuan pengelolaan data kapan saja dengan
              menghapus akun, atau menyampaikan keberatan dan pengaduan ke{" "}
              <Isian k="emailPrivasi" />. Kami menanggapi setiap permintaan
              paling lambat <Isian k="waktuTanggapan" />.
            </p>
          </Bagian>

          <Bagian id="keamanan" nomor={nomorBagian("keamanan")} judul="Keamanan">
            <ul className={daftar}>
              <li>Kata sandi hanya disimpan dalam bentuk hash.</li>
              <li>
                Setiap halaman dan data dibatasi menurut peran: orang tua
                tidak bisa membuka data anak keluarga lain.
              </li>
              <li>Percobaan masuk yang berlebihan dibatasi.</li>
            </ul>
            <p className={`mt-4 ${alinea}`}>
              Bila terjadi kebocoran data pribadi, kami akan memberi tahu Anda
              sesuai ketentuan UU PDP.
            </p>
          </Bagian>

          <Bagian id="perubahan" nomor={nomorBagian("perubahan")} judul="Perubahan kebijakan">
            <p className={alinea}>
              Bila kebijakan ini berubah, tanggal berlakunya di bagian atas
              halaman ikut diperbarui. Untuk perubahan penting, kami juga
              memberi tahu lewat email.
            </p>
          </Bagian>

          <Bagian id="kontak" nomor={nomorBagian("kontak")} judul="Menghubungi kami">
            <p className={alinea}>
              Untuk pertanyaan, permintaan, atau pengaduan tentang data
              pribadi:
            </p>
            <dl className="mt-5 space-y-3 text-lg leading-relaxed">
              <div>
                <dt className="text-sm font-semibold text-ld-ink">Email</dt>
                <dd className="text-ld-muted">
                  <Isian k="emailPrivasi" />
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ld-ink">Alamat</dt>
                <dd className="text-ld-muted">
                  <Isian k="alamat" />
                </dd>
              </div>
            </dl>
          </Bagian>
        </div>

        <p className="mt-16">
          <Link href="/" className={`${tautan} font-semibold`}>
            Kembali ke beranda
          </Link>
        </p>
      </article>
    </Halaman>
  );
}
