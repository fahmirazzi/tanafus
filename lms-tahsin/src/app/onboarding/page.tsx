import type { Metadata } from "next";
import Link from "next/link";
import { amiri, jakarta, ruqaa } from "@/components/landing/fonts";
import { tautan } from "@/components/landing/gaya";
import { Kaligrafi } from "@/components/landing/kaligrafi";
import { whatsappHref } from "@/components/landing/whatsapp";
import { FormOnboarding } from "@/components/onboarding/form-onboarding";
import { TombolTema } from "@/components/tema/tombol-tema";

export const metadata: Metadata = {
  title: "Cari Guru Tahsin yang Cocok",
  description:
    "Jawab beberapa pertanyaan singkat tentang usia, bacaan, dan waktu belajar. Kami bantu carikan guru tahsin privat yang cocok.",
  alternates: { canonical: "/onboarding" },
  // Halaman alur, bukan konten: tidak perlu muncul di hasil pencarian.
  robots: { index: false, follow: true },
};

/**
 * Form singkat untuk pengunjung baru, tujuan ajakan utama halaman depan.
 *
 * Sengaja tanpa navigasi dan footer halaman depan: satu tugas di layar ini.
 * Hanya logo (kembali ke beranda) dan tautan keluar. Tanpa MotionRoot
 * (tidak ada Lenis atau animasi gulir); gerak form ada di komponennya.
 */
export default function OnboardingPage() {
  return (
    <div
      className={`ld ${jakarta.variable} ${amiri.variable} ${ruqaa.variable} relative isolate min-h-dvh overflow-x-clip bg-ld-paper font-ld-sans text-ld-ink antialiased`}
    >
      <Kaligrafi kata="بداية" arti="permulaan" posisi="kanan-atas" className="text-[clamp(9rem,28vw,26rem)]" />

      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 md:h-[72px] md:px-8">
        <Link
          href="/"
          className="group/logo flex items-baseline gap-0.5 rounded-full text-xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ld-ink"
        >
          Tanafus
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-ld-red transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/logo:-translate-y-1.5"
          />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className={`${tautan} text-sm font-medium`}>
            Kembali ke beranda
          </Link>
          <TombolTema />
        </div>
      </header>

      <main className="px-5 pb-24 pt-10 md:px-8 md:pb-32 md:pt-16">
        <noscript>
          <p className="mx-auto mb-10 max-w-3xl rounded-2xl border border-ld-line bg-ld-surface p-6 text-lg">
            Form ini membutuhkan JavaScript.{" "}
            {whatsappHref ? (
              <a href={whatsappHref} className={`${tautan} font-semibold`}>
                Chat kami langsung via WhatsApp
              </a>
            ) : (
              <Link href="/instructors" className={`${tautan} font-semibold`}>
                Lihat daftar guru kami
              </Link>
            )}
            .
          </p>
        </noscript>
        <FormOnboarding />
      </main>
    </div>
  );
}
