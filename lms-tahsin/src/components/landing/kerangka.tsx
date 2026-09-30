import Link from "next/link";
import { ArrowRight, ArrowUpRight, MessageCircle } from "lucide-react";
import { MotionRoot } from "./motion-root";
import { amiri, jakarta, ruqaa } from "./fonts";
import { panahTombol, tautan, tombolUtama } from "./gaya";
import { WHATSAPP_MESSAGE, whatsappHref } from "./whatsapp";
import { TombolTema } from "@/components/tema/tombol-tema";

export { tautan, WHATSAPP_MESSAGE, whatsappHref };

/**
 * Kerangka bersama halaman publik (beranda dan /tentang): navigasi, footer,
 * tombol ajakan, dan penekanan kata. Satu sumber agar kedua halaman tidak
 * bisa menyimpang.
 *
 * Dua ajakan, dua niat:
 * - TombolMulai   : ajakan utama pengunjung baru, ke form singkat /onboarding
 *                   yang berakhir di WhatsApp dengan jawaban sudah tersusun.
 * - TombolWhatsApp: untuk yang ingin langsung bertanya (akhir FAQ, tombol
 *                   mengambang, tautan sekunder di bawah ajakan utama).
 */
const CTA_LABEL = "Chat via WhatsApp";
const CTA_MULAI = "Cari guru yang cocok";
export const MOTTO = "Berlomba menuju bacaan terbaik.";

/**
 * Ajakan utama: ke form /onboarding. `lokasi` masuk ke
 * data-analytics-lokasi, supaya bisa dibandingkan tombol di bagian mana yang
 * paling sering ditekan.
 */
export function TombolMulai({
  className = "",
  lokasi,
}: {
  className?: string;
  lokasi?: string;
}) {
  return (
    <Link
      href="/onboarding"
      data-analytics="cta-onboarding"
      data-analytics-lokasi={lokasi}
      className={`${tombolUtama} ${className}`}
    >
      {CTA_MULAI}
      <ArrowRight
        aria-hidden="true"
        strokeWidth={2.25}
        className={`${panahTombol} group-hover/tombol:translate-x-1`}
      />
    </Link>
  );
}

/**
 * Tautan sekunder di bawah ajakan utama, untuk yang lebih suka langsung
 * bertanya. Tidak dirender bila nomor WhatsApp belum diatur.
 */
export function TautanWhatsApp({
  className = "",
  lokasi,
}: {
  className?: string;
  lokasi?: string;
}) {
  if (!whatsappHref) return null;
  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics="cta-whatsapp"
      data-analytics-lokasi={lokasi}
      className={`${tautan} font-semibold ${className}`}
    >
      atau tanya dulu via WhatsApp
    </a>
  );
}

export const judulBagian =
  "text-balance text-4xl font-bold leading-[1.05] tracking-[-0.03em] md:text-6xl";

/**
 * `lokasi` masuk ke data-analytics-lokasi, supaya bisa dibandingkan tombol
 * di bagian mana yang paling sering ditekan.
 */
export function TombolWhatsApp({
  className = "",
  lokasi,
}: {
  className?: string;
  lokasi?: string;
}) {
  if (!whatsappHref) {
    return (
      <Link href="/instructors" className={`${tombolUtama} ${className}`}>
        Lihat guru privat
        <ArrowRight
          aria-hidden="true"
          strokeWidth={2.25}
          className={`${panahTombol} group-hover/tombol:translate-x-1`}
        />
      </Link>
    );
  }
  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics="cta-whatsapp"
      data-analytics-lokasi={lokasi}
      className={`${tombolUtama} ${className}`}
    >
      {CTA_LABEL}
      {/* Serong: membuka WhatsApp di tab baru. */}
      <ArrowUpRight
        aria-hidden="true"
        strokeWidth={2.25}
        className={`${panahTombol} group-hover/tombol:-translate-y-0.5 group-hover/tombol:translate-x-0.5`}
      />
    </a>
  );
}

/**
 * Teks Arab di tengah kalimat Latin. Plus Jakarta Sans tidak punya glyph Arab,
 * jadi tanpa ini browser memakai font cadangan: ﷺ tampil sebagai coretan kecil.
 * Amiri (subset "arabic" mencakup U+FB50-FDFF, termasuk ﷺ) dipakai di sini.
 */
export function HurufArab({ children }: { children: React.ReactNode }) {
  return (
    <span lang="ar" className="font-ld-arabic text-[1.15em] leading-none">
      {children}
    </span>
  );
}

/**
 * Penekanan kata dengan tema titik. Ukuran kata TIDAK berubah.
 *
 * Titik merah duduk di luar sudut kanan atas kata, posisi yang sama dengan
 * titik di huruf hero. Dengan JS (motion-root.tsx): kata mula-mula berwarna
 * seperti teks di sekitarnya, titik jatuh dan memantul, dan saat titik
 * menyentuh kata berubah warna sementara cincin riak menyebar dari titik.
 * Tanpa JS atau saat gerak dikurangi: langsung keadaan akhir.
 *
 * `nada="tinta"` untuk di atas blok merah, di mana kata merah tidak terlihat.
 *
 * Jangan dipasang di dalam elemen `data-lines`: mask baris SplitText memakai
 * overflow: clip dan akan memotong titik yang berada di atas baris.
 */
export function Tekanan({
  children,
  nada = "merah",
}: {
  children: React.ReactNode;
  nada?: "merah" | "tinta";
}) {
  const merah = nada === "merah";
  return (
    <span
      data-tekanan
      className={`relative inline-block ${merah ? "text-ld-red" : "text-ld-ink"}`}
    >
      {children}
      {/* Titik duduk di atas ujung kanan kata itu sendiri, hanya sedikit
          melewatinya. Diukur: spasi di judul hanya ~0,14 em (tracking
          rapat), lebih sempit dari titiknya, jadi titik yang menjorok ke
          celah spasi menabrak kata berikutnya ("Guru Tanafus", "tiga
          langkah"). Dengan -0,1 em titik bersih dari kata berikutnya dan
          dari puncak huruf kapital, dan tetap dekat dengan katanya sendiri
          saat kata itu jatuh di baris kedua. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[0.1em] top-[0.03em] size-[0.18em]"
      >
        <span
          data-tekanan-riak
          className={`absolute inset-0 rounded-full border-[0.03em] opacity-0 ${
            merah ? "border-ld-red" : "border-ld-ink"
          }`}
        />
        <span
          data-tekanan-titik
          className={`absolute inset-0 rounded-full ${merah ? "bg-ld-red" : "bg-ld-ink"}`}
        />
      </span>
    </span>
  );
}

function Navigasi() {
  return (
    // Lapisan bertumpuk: navigasi z-40, tombol WhatsApp mengambang z-30.
    // data-navigasi: motion-root.tsx membuatnya transparan di puncak halaman
    // dan memunculkan latar + garis setelah digulir (globals.css).
    <header
      data-navigasi
      className="sticky top-0 z-40 border-b border-ld-line/60 bg-ld-paper/85 backdrop-blur-md"
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 md:h-[72px] md:px-8">
        <Link
          href="/"
          className="group/logo flex items-baseline gap-0.5 rounded-full text-xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ld-ink"
        >
          Tanafus
          {/* Titik logo melompat kecil saat disorot. */}
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-ld-red transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/logo:-translate-y-1.5"
          />
        </Link>
        <div className="flex items-center gap-4 md:gap-6">
          <TombolTema className="max-[359px]:hidden" />
          <Link
            href="/tentang"
            className={`${tautan} text-sm font-medium max-md:hidden`}
          >
            Tentang
          </Link>
          <Link
            href="/login"
            className={`${tautan} text-sm font-medium max-sm:hidden`}
          >
            Masuk
          </Link>
          {/* Tetap tampil di ponsel: CTA yang selalu terjangkau saat
              menggulir. Di bawah 360px tombol ini tidak muat satu baris. */}
          <TombolMulai
            lokasi="navigasi"
            className="!px-5 !py-2.5 !text-sm max-[359px]:!hidden"
          />
        </div>
      </nav>
    </header>
  );
}

function Kaki() {
  return (
    <footer className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 text-sm text-ld-muted md:flex-row md:items-center md:justify-between md:px-8">
      <p>
        <span className="font-semibold text-ld-ink">Tanafus Center</span>
        <span className="mx-2" aria-hidden="true">
          ·
        </span>
        {MOTTO}
      </p>
      <div className="flex gap-7">
        <Link href="/tentang" className={tautan}>
          Tentang
        </Link>
        <Link href="/instructors" className={tautan}>
          Guru privat
        </Link>
        <Link href="/login" className={tautan}>
          Masuk
        </Link>
      </div>
    </footer>
  );
}

/**
 * Tombol WhatsApp yang mengambang di pojok kanan bawah. Di ponsel hanya ikon
 * (label tetap dibaca pembaca layar). Tanpa JS selalu tampil; dengan JS
 * muncul setelah hero dan bersembunyi saat blok ajakan penutup terlihat.
 */
function TombolMengambang() {
  if (!whatsappHref) return null;
  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics="cta-whatsapp"
      data-analytics-lokasi="mengambang"
      data-mengambang
      className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-ld-red p-4 font-semibold text-ld-on-red shadow-[0_12px_32px_-12px_rgb(200_38_27/0.7)] transition-transform hover:-translate-y-0.5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ld-ink md:bottom-6 md:right-6 md:px-6 md:py-3.5"
    >
      <MessageCircle aria-hidden="true" strokeWidth={2.25} className="size-6 md:size-5" />
      <span className="max-md:sr-only">{CTA_LABEL}</span>
    </a>
  );
}

/** Pembungkus halaman publik: token, font, gerak, navigasi, footer. */
export function Halaman({ children }: { children: React.ReactNode }) {
  return (
    <MotionRoot
      className={`ld ${jakarta.variable} ${amiri.variable} ${ruqaa.variable} min-h-dvh overflow-x-clip bg-ld-paper font-ld-sans text-ld-ink antialiased`}
    >
      <Navigasi />
      <main>{children}</main>
      <Kaki />
      <TombolMengambang />
    </MotionRoot>
  );
}
