"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { panahTombol, tautan, tombolUtama } from "@/components/landing/gaya";
import { buatTautanWhatsApp } from "@/components/landing/whatsapp";
import {
  pertanyaanAktif,
  susunBaris,
  susunPesan,
  type Hiasan,
  type IdPilihan,
  type Jawaban,
  type Pertanyaan,
} from "./pertanyaan";

gsap.registerPlugin(useGSAP, SplitText);

const JAWABAN_AWAL: Jawaban = { waktu: [], nama: "" };

/**
 * Form singkat untuk pengunjung baru. Satu pertanyaan per layar, jawaban
 * berupa kartu berhias kata Arab (atau titik), lalu ringkasan yang dikirim
 * sendiri oleh pengunjung lewat WhatsApp. Tidak ada yang disimpan.
 *
 * Gerak (semua mati saat gerak dikurangi):
 * - pindah pertanyaan : isi lama keluar, judul dan kartu baru masuk
 *                       bergiliran dari arah maju/mundur;
 * - pilih kartu       : kartu memantul kecil, titik merah muncul di sudutnya;
 *                       tombol "Lanjut" ikut menyala;
 * - ringkasan         : tanda "sedang mengetik", lalu pesan muncul kata demi kata.
 *
 * Memilih kartu TIDAK memindahkan layar: pengunjung selalu maju lewat
 * "Lanjut" (atau Enter). Sama di setiap layar, termasuk pertanyaan waktu
 * (boleh pilih beberapa) dan nama, dan pilihan masih bisa diganti sebelum
 * maju. Di ponsel baris tombol menempel di bawah layar supaya tetap terjangkau.
 *
 * Aksesibilitas: kartu adalah radio/checkbox asli di dalam fieldset; panah
 * mengganti pilihan, Enter atau "Lanjut" untuk maju.
 */
export function FormOnboarding() {
  const root = useRef<HTMLDivElement>(null);
  const judul = useRef<HTMLHeadingElement>(null);
  const [jawaban, setJawaban] = useState<Jawaban>(JAWABAN_AWAL);
  const [indeks, setIndeks] = useState(0);
  const arah = useRef<1 | -1>(1);
  const sedangPindah = useRef(false);
  const sudahBerpindah = useRef(false);

  const daftar = pertanyaanAktif(jawaban);
  // Layar: semua pertanyaan pilihan, lalu nama, lalu ringkasan.
  const jumlahLayar = daftar.length + 2;
  const layar = Math.min(indeks, jumlahLayar - 1);
  const tanya: Pertanyaan | undefined = daftar[layar];
  const diNama = layar === daftar.length;
  const diRingkasan = layar === daftar.length + 1;

  const terjawab = tanya
    ? tanya.jamak
      ? jawaban.waktu.length > 0
      : Boolean(jawaban[tanya.id as Exclude<IdPilihan, "waktu">])
    : diNama
      ? jawaban.nama.trim().length >= 2
      : true;

  const gerakDikurangi = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !(
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(location.search).has("motion")
    );

  // --- Masuk: setiap kali layar berganti ----------------------------------
  useGSAP(
    () => {
      const langkah = root.current?.querySelector("[data-langkah]");
      if (!langkah) return;
      if (sudahBerpindah.current) {
        // Fokus ke judul pertanyaan baru, supaya pembaca layar ikut pindah.
        judul.current?.focus({ preventScroll: true });
        const atas = root.current!.getBoundingClientRect().top;
        if (atas < 0)
          window.scrollBy({
            top: atas - 24,
            behavior: gerakDikurangi() ? "auto" : "smooth",
          });
      }
      if (gerakDikurangi()) return;

      const dx = arah.current * 48;
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.fromTo(
        langkah.querySelectorAll("[data-masuk]"),
        { opacity: 0, x: dx, y: 12 },
        { opacity: 1, x: 0, y: 0, duration: 0.8, stagger: 0.06 },
      );
      const kartu = langkah.querySelectorAll("[data-kartu]");
      if (kartu.length) {
        tl.fromTo(
          kartu,
          { opacity: 0, y: 36, scale: 0.96 },
          { opacity: 1, y: 0, scale: 1, duration: 0.85, stagger: 0.07 },
          0.12,
        );
        // Hiasan menyusul, bergeser pelan dari kanan (arah tulisan Arab).
        // Yang dianimasikan elemen DALAM ke opacity 1 yang eksplisit;
        // kepudarannya (0,1) ada di elemen luar lewat kelas CSS. from() yang
        // membaca opacity saat itu sempat berakhir di ~0: di development
        // React memasang efek dua kali, dan nilai yang terbaca setengah jalan.
        tl.fromTo(
          langkah.querySelectorAll("[data-hiasan]"),
          { opacity: 0, xPercent: 18 },
          {
            opacity: 1,
            xPercent: 0,
            duration: 1.2,
            stagger: 0.07,
            clearProps: "opacity,transform",
          },
          0.3,
        );
      }

      // Ringkasan: tanda mengetik, lalu pesan muncul kata demi kata.
      const pesan = langkah.querySelector<HTMLElement>("[data-pesan-isi]");
      const mengetik = langkah.querySelector<HTMLElement>("[data-mengetik]");
      if (pesan && mengetik) {
        const kata = SplitText.create(pesan, { type: "words" }).words;
        gsap.set(kata, { opacity: 0 });
        tl.set(mengetik, { opacity: 1 }, 0.3)
          .fromTo(
            mengetik.children,
            { y: 0 },
            {
              y: -5,
              duration: 0.26,
              ease: "sine.inOut",
              stagger: { each: 0.1, repeat: 3, yoyo: true },
            },
            0.3,
          )
          .to(mengetik, { opacity: 0, duration: 0.15 })
          .to(kata, {
            opacity: 1,
            duration: 0.25,
            ease: "none",
            stagger: 0.03,
          });
      }
    },
    { scope: root, dependencies: [layar], revertOnUpdate: true },
  );

  // --- Keluar lalu pindah layar -------------------------------------------
  // Handler biasa, bukan contextSafe: tween di sini pendek dan sekali jalan
  // (elemen lamanya memang segera dilepas), dan contextSafe yang dibuat saat
  // render melanggar aturan react-hooks/refs.
  const pindah = (ke: number) => {
    if (sedangPindah.current || ke < 0 || ke >= jumlahLayar) return;
    arah.current = ke > layar ? 1 : -1;
    sudahBerpindah.current = true;
    const langkah = root.current?.querySelector("[data-langkah]");
    if (!langkah || gerakDikurangi()) {
      setIndeks(ke);
      return;
    }
    sedangPindah.current = true;
    gsap.to(langkah.querySelectorAll("[data-masuk], [data-kartu]"), {
      opacity: 0,
      x: -arah.current * 36,
      duration: 0.28,
      ease: "power2.in",
      stagger: 0.025,
      onComplete: () => {
        sedangPindah.current = false;
        setIndeks(ke);
      },
    });
  };

  const pilih = (id: IdPilihan, nilai: string) => {
    setJawaban((j) => {
      if (id === "waktu") {
        const ada = j.waktu.includes(nilai);
        return {
          ...j,
          waktu: ada ? j.waktu.filter((w) => w !== nilai) : [...j.waktu, nilai],
        };
      }
      return { ...j, [id]: nilai };
    });
  };

  // Klik kartu: pantulan kecil saja. Maju tetap lewat "Lanjut".
  const klikKartu = (e: React.MouseEvent<HTMLLabelElement>) => {
    if (gerakDikurangi()) return;
    gsap.fromTo(
      e.currentTarget,
      { scale: 0.97 },
      { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" },
    );
  };

  const lanjut = (e: React.FormEvent) => {
    e.preventDefault();
    if (terjawab && !diRingkasan) pindah(layar + 1);
  };

  // Browser tidak mengirim form saat Enter ditekan di radio/checkbox (hanya
  // di kolom teks), jadi Enter pada kartu ditangani di sini: maju bila sudah
  // terjawab. Spasi tetap memilih seperti biasa.
  const enterDiKartu = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const el = e.target as HTMLInputElement;
    if (e.key === "Enter" && (el.type === "radio" || el.type === "checkbox")) {
      e.preventDefault();
      if (terjawab) pindah(layar + 1);
    }
  };

  const tautanKirim = buatTautanWhatsApp(susunPesan(jawaban));
  const nomorLayar = Math.min(layar + 1, jumlahLayar - 1);

  return (
    <div ref={root} className="mx-auto w-full max-w-3xl">
      <Kemajuan jumlah={jumlahLayar - 1} aktif={layar} />

      <form
        onSubmit={lanjut}
        onKeyDown={enterDiKartu}
        noValidate
        className="mt-10 md:mt-14"
      >
        <div key={layar} data-langkah>
          {!diRingkasan ? (
            <p data-masuk className="text-sm font-semibold text-ld-muted">
              Pertanyaan {nomorLayar} dari {jumlahLayar - 1}
            </p>
          ) : null}

          {tanya ? (
            <fieldset>
              <legend className="contents">
                <h1
                  ref={judul}
                  tabIndex={-1}
                  data-masuk
                  className="mt-3 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.03em] outline-none md:text-5xl"
                >
                  {tanya.tanya(jawaban)}
                </h1>
              </legend>
              {tanya.bantuan ? (
                <p
                  data-masuk
                  className="mt-4 max-w-[52ch] text-lg leading-relaxed text-ld-muted"
                >
                  {tanya.bantuan}
                </p>
              ) : null}
              <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {tanya.pilihan.map((p) => {
                  const terpilih = tanya.jamak
                    ? jawaban.waktu.includes(p.nilai)
                    : jawaban[tanya.id as Exclude<IdPilihan, "waktu">] ===
                      p.nilai;
                  return (
                    <label
                      key={p.nilai}
                      data-kartu
                      onClick={klikKartu}
                      className="group/kartu relative isolate flex min-h-32 cursor-pointer flex-col justify-center overflow-hidden rounded-3xl border border-ld-line bg-ld-surface px-6 py-6 transition-[border-color,box-shadow,translate] duration-300 hover:-translate-y-1 hover:border-ld-ink/25 has-[input:checked]:border-ld-red has-[input:checked]:shadow-[0_18px_40px_-24px_rgb(200_38_27/0.55)] has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-ld-ink md:min-h-40 md:px-7"
                    >
                      <input
                        type={tanya.jamak ? "checkbox" : "radio"}
                        name={tanya.id}
                        value={p.nilai}
                        checked={terpilih}
                        onChange={() => pilih(tanya.id, p.nilai)}
                        className="sr-only"
                      />
                      <HiasanKartu hiasan={p.hiasan} />
                      <span className="relative max-w-[80%] text-xl font-semibold leading-snug tracking-tight md:text-2xl">
                        {p.judul}
                      </span>
                      {p.ket ? (
                        <span className="relative mt-1.5 text-sm text-ld-muted md:text-base">
                          {p.ket}
                        </span>
                      ) : null}
                      {/* Titik merah di sudut: tanda terpilih, tema titik halaman depan. */}
                      <span
                        aria-hidden="true"
                        className="absolute right-5 top-5 flex size-6 scale-0 items-center justify-center rounded-full bg-ld-red text-ld-on-red transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-has-[input:checked]/kartu:scale-100"
                      >
                        {tanya.jamak ? (
                          <Check strokeWidth={3} className="size-3.5" />
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {diNama ? (
            <div className="relative">
              <h1
                ref={judul}
                tabIndex={-1}
                data-masuk
                className="mt-3 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.03em] outline-none md:text-5xl"
              >
                Siapa nama Anda?
              </h1>
              <p
                data-masuk
                className="mt-4 max-w-[52ch] text-lg leading-relaxed text-ld-muted"
              >
                Supaya kami bisa menyapa Anda dengan benar.
              </p>
              <div data-masuk className="relative mt-10">
                <span
                  aria-hidden="true"
                  lang="ar"
                  dir="rtl"
                  className="pointer-events-none absolute -top-10 right-0 select-none font-ld-decor text-[6rem] leading-none text-ld-ink opacity-[0.06] md:text-[8rem]"
                >
                  اِسْم
                </span>
                <label htmlFor="nama" className="sr-only">
                  Nama Anda
                </label>
                <input
                  id="nama"
                  name="nama"
                  autoComplete="name"
                  maxLength={60}
                  placeholder="Nama Anda"
                  value={jawaban.nama}
                  onChange={(e) =>
                    setJawaban((j) => ({ ...j, nama: e.target.value }))
                  }
                  className="relative w-full border-b-2 border-ld-line bg-transparent pb-3 text-3xl font-semibold tracking-tight outline-none transition-colors placeholder:text-ld-muted/50 focus:border-ld-red md:text-4xl"
                />
              </div>
            </div>
          ) : null}

          {diRingkasan ? (
            <Ringkasan judulRef={judul} baris={susunBaris(jawaban)} />
          ) : null}
        </div>

        {/* Navigasi form. Di ponsel menempel di bawah layar, supaya "Lanjut"
            tetap terlihat setelah memilih kartu yang letaknya di bawah. */}
        <div className="sticky bottom-0 z-10 -mx-5 mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-ld-line bg-ld-paper/90 px-5 py-4 backdrop-blur-md md:static md:mx-0 md:mt-12 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          {layar > 0 ? (
            <button
              type="button"
              onClick={() => pindah(diRingkasan ? 0 : layar - 1)}
              className={`${tautan} inline-flex items-center gap-2 font-semibold`}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {diRingkasan ? "Ubah jawaban" : "Kembali"}
            </button>
          ) : (
            <span />
          )}

          {!diRingkasan ? (
            <button type="submit" disabled={!terjawab} className={tombolUtama}>
              {diNama ? "Lihat ringkasan" : "Lanjut"}
              <ArrowRight
                aria-hidden="true"
                strokeWidth={2.25}
                className={`${panahTombol} group-hover/tombol:translate-x-1`}
              />
            </button>
          ) : tautanKirim ? (
            <a
              href={tautanKirim}
              target="_blank"
              rel="noopener noreferrer"
              data-analytics="cta-whatsapp"
              data-analytics-lokasi="onboarding-selesai"
              className={tombolUtama}
            >
              Kirim lewat WhatsApp
              <ArrowUpRight
                aria-hidden="true"
                strokeWidth={2.25}
                className={`${panahTombol} group-hover/tombol:-translate-y-0.5 group-hover/tombol:translate-x-0.5`}
              />
            </a>
          ) : (
            <Link href="/instructors" className={tombolUtama}>
              Lihat guru privat
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}

/** Deretan titik kemajuan: selesai = tinta, sekarang = pil merah, belum = garis. */
function Kemajuan({ jumlah, aktif }: { jumlah: number; aktif: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Kemajuan form"
      aria-valuemin={1}
      aria-valuemax={jumlah + 1}
      aria-valuenow={aktif + 1}
      className="flex items-center gap-2"
    >
      {Array.from({ length: jumlah + 1 }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            i === aktif
              ? "w-9 bg-ld-red"
              : i < aktif
                ? "w-2.5 bg-ld-ink"
                : "w-2.5 bg-ld-line"
          }`}
        />
      ))}
    </div>
  );
}

/** Hiasan kartu: kata Arab besar dan pudar, atau deretan titik (usia). */
function HiasanKartu({ hiasan }: { hiasan: Hiasan }) {
  if (hiasan.jenis === "titik") {
    return (
      <span aria-hidden="true" className="absolute bottom-5 right-6">
        <span data-hiasan className="flex items-end gap-1.5">
          {Array.from({ length: hiasan.jumlah }, (_, i) => (
            <span
              key={i}
              className="rounded-full bg-ld-ink/15 transition-colors duration-300 group-has-[input:checked]/kartu:bg-ld-red"
              style={{ width: 10 + i * 4, height: 10 + i * 4 }}
            />
          ))}
        </span>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      lang="ar"
      dir="rtl"
      // Di sisi kanan, sedikit di bawah tengah (titik tanda terpilih ada di
      // pojok kanan atas). leading lapang agar harakat tidak terpotong.
      className="pointer-events-none absolute right-5 top-[58%] -translate-y-1/2 select-none whitespace-nowrap font-ld-decor text-[3.75rem] leading-[1.5] text-ld-ink opacity-[0.1] transition-[color,opacity,translate] duration-500 group-hover/kartu:-translate-x-2 group-has-[input:checked]/kartu:text-ld-red group-has-[input:checked]/kartu:opacity-[0.22] md:right-7 md:text-[4.75rem]"
    >
      <span data-hiasan className="inline-block">
        {hiasan.teks}
      </span>
    </span>
  );
}

/** Layar terakhir: pratinjau pesan WhatsApp yang akan dikirim. */
function Ringkasan({
  judulRef,
  baris,
}: {
  judulRef: React.RefObject<HTMLHeadingElement | null>;
  baris: string[];
}) {
  return (
    <div>
      <h1
        ref={judulRef}
        tabIndex={-1}
        data-masuk
        className="text-balance text-3xl font-bold leading-[1.1] tracking-[-0.03em] outline-none md:text-5xl"
      >
        Ini pesan yang akan Anda kirim.
      </h1>
      <p
        data-masuk
        className="mt-4 max-w-[52ch] text-lg leading-relaxed text-ld-muted"
      >
        Tombol di bawah membuka WhatsApp dengan pesan ini sudah terisi. Anda
        masih bisa mengubahnya sebelum mengirim.
      </p>
      <figure
        data-masuk
        className="relative mt-10 rounded-3xl rounded-tl-md border border-ld-line bg-ld-surface p-7 md:p-9"
      >
        <span
          aria-hidden="true"
          data-mengetik
          className="absolute left-7 top-8 flex gap-1.5 opacity-0 md:left-9 md:top-10"
        >
          {[0, 1, 2].map((k) => (
            <span key={k} className="size-2.5 rounded-full bg-ld-muted" />
          ))}
        </span>
        <blockquote
          data-pesan-isi
          className="space-y-2 text-lg leading-relaxed md:text-xl"
        >
          {baris.map((b, i) => (
            <p key={i} className={i === 0 ? "pb-2" : undefined}>
              {b}
            </p>
          ))}
        </blockquote>
      </figure>
      <p data-masuk className="mt-5 text-sm text-ld-muted">
        Jawaban Anda tidak disimpan di situs ini. Jawaban hanya sampai ke kami
        bila Anda mengirim pesannya di WhatsApp.
      </p>
    </div>
  );
}
