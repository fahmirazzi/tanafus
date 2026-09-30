"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Titik pemandu halaman /tentang: satu titik merah yang menemani pembaca dari
 * bagian ke bagian dan mendarat di hal penting tiap bagian.
 *
 * Perjalanan dan perubahan bentuk dipisah:
 * - DI JALAN titik selalu titik biasa (lingkaran kecil). Posisinya tersambung
 *   ke gulir (scrub) dan lintasannya melengkung, jadi titik "melompat".
 * - SAAT TIBA titik baru berubah menjadi bentuk haltenya (lingkaran besar,
 *   garis fathah, garis bawah kata) dengan pantulan elastis. Perubahan ini
 *   berbasis waktu, bukan gulir, supaya pantulannya selalu terasa.
 * - SAAT BERANGKAT titik kembali menjadi titik biasa, dengan sedikit ancang-
 *   ancang (membesar sebentar lalu mengecil), baru berjalan.
 * - Halte `data-tenggelam` (blok ajakan): titik tiba sebagai titik biasa,
 *   memantul sekali di tepi blok, lalu tenggelam ke dalamnya, dan blok yang
 *   tadinya agak transparan menjadi penuh.
 *
 * Cara kerja
 * - Tiap tempat singgah adalah elemen ber-`data-halte`. Kotaknya menentukan
 *   posisi dan bentuk titik saat singgah.
 * - Tiap ruas (halte i ke i+1) punya rentang gulir: berangkat saat pemicu
 *   halte i mencapai `data-berangkat` (bawaan "center 38%"), tiba saat pemicu
 *   halte i+1 mencapai `data-tiba` (bawaan "center 60%").
 * - Posisi titik DAN rentang gulir dibaca langsung dari getBoundingClientRect
 *   setiap frame, jadi titik tetap menempel pada elemen sticky, elemen yang
 *   sedang dianimasikan masuk, dan tata letak yang bergeser.
 *
 * Atribut halte
 * - data-picu / data-picu-md : selektor elemen pemicu gulir (bawaan: halte itu)
 * - data-tiba(-md), data-berangkat(-md) : "tepi persen", mis. "center 58%"
 *   (tepi elemen pemicu: top/center/bottom; persen: tinggi layar, boleh
 *   negatif untuk panggung sticky yang panjang)
 * - data-putar  : rotasi bentuk saat singgah (derajat), mis. garis fathah
 * - data-sudut  : radius sudut (px); bawaan bulat
 * - data-tenggelam : halte blok ajakan (lihat di atas); bloknya ditandai
 *   `data-blok-tenggelam`
 * Elemen `[data-sorot]` terdekat dari halte diberi `data-disinggahi` selama
 * titik singgah di sana (kartu nilai: garisnya memerah).
 *
 * Gerak dikurangi atau tanpa JS: komponen ini tidak melakukan apa-apa; halte
 * yang bergambar tampil diam sebagai ilustrasi. Selama titik aktif, halte
 * disembunyikan lewat `html[data-pemandu-aktif]` (globals.css).
 */

type Halte = {
  el: HTMLElement;
  picu: HTMLElement;
  tiba: string;
  berangkat: string;
  putar: number;
  sudut: number | null;
  tenggelam: boolean;
};

/** Opacity blok ajakan sebelum titik tenggelam ke dalamnya. */
const BLOK_TRANSPARAN = 0.6;

const campur = (a: number, b: number, p: number) => a + (b - a) * p;

export function TitikPemandu() {
  const titik = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    const paksa =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).has("motion");

    mm.add(
      {
        gerak: paksa ? "all" : "(prefers-reduced-motion: no-preference)",
        lebar: "(min-width: 768px)",
      },
      (konteks) => {
        const { gerak, lebar } = konteks.conditions as { gerak: boolean; lebar: boolean };
        const el = titik.current;
        if (!gerak || !el) return;

        const baca = (h: HTMLElement, nama: string) =>
          (lebar && h.getAttribute(`data-${nama}-md`)) || h.getAttribute(`data-${nama}`);

        const halte: Halte[] = gsap.utils.toArray<HTMLElement>("[data-halte]").map((h) => {
          const selektor = baca(h, "picu");
          return {
            el: h,
            picu: (selektor && document.querySelector<HTMLElement>(selektor)) || h,
            // Jendela istirahat bawaan 22% layar: cukup untuk pantulan
            // perubahan bentuk (0,9 dtk) terlihat utuh saat terus menggulir.
            tiba: baca(h, "tiba") ?? "center 60%",
            berangkat: baca(h, "berangkat") ?? "center 38%",
            putar: parseFloat(h.dataset.putar ?? "0"),
            sudut: h.dataset.sudut ? parseFloat(h.dataset.sudut) : null,
            tenggelam: h.hasAttribute("data-tenggelam"),
          };
        });
        if (halte.length < 2) return;

        document.documentElement.setAttribute("data-pemandu-aktif", "");
        const blok = document.querySelector<HTMLElement>("[data-blok-tenggelam]");
        if (blok) gsap.set(blok, { opacity: BLOK_TRANSPARAN });

        // Posisi gulir saat tepi `picu` mencapai persentase layar tertentu,
        // dihitung dari geometri SAAT INI. Rentang yang dihitung sekali saat
        // halaman dimuat sempat bergeser 48 px karena blok data-reveal masih
        // tergeser, dan titik tertahan di tengah jalan.
        const titikGulir = (picu: HTMLElement, posisi: string) => {
          const [tepi, persen] = posisi.split(" ");
          const r = picu.getBoundingClientRect();
          const yTepi = tepi === "top" ? r.top : tepi === "bottom" ? r.bottom : r.top + r.height / 2;
          return window.scrollY + yTepi - (parseFloat(persen) / 100) * window.innerHeight;
        };

        /** Diam di halte i (p null), atau di jalan dari i ke i+1 dengan kemajuan p. */
        const tentukan = (): { i: number; p: number | null } => {
          const y = window.scrollY;
          for (let i = 0; i < halte.length - 1; i++) {
            const mulai = titikGulir(halte[i].picu, halte[i].berangkat);
            const selesai = titikGulir(halte[i + 1].picu, halte[i + 1].tiba);
            if (y >= selesai) continue;
            if (y < mulai) return { i, p: null };
            const rentang = selesai - mulai;
            return { i, p: rentang > 0 ? gsap.utils.clamp(0, 1, (y - mulai) / rentang) : 1 };
          }
          return { i: halte.length - 1, p: null };
        };

        // Ruas terbalik (tiba sebelum berangkat) membuat titik melompat tanpa
        // perjalanan. Di development, beri tahu sekali setelah tata letak tenang.
        const periksa = gsap.delayedCall(2, () => {
          if (process.env.NODE_ENV === "production") return;
          halte.slice(0, -1).forEach((h, i) => {
            const mulai = titikGulir(h.picu, h.berangkat);
            const selesai = titikGulir(halte[i + 1].picu, halte[i + 1].tiba);
            if (selesai <= mulai) {
              console.warn(
                `[titik-pemandu] ruas ${i}→${i + 1} terbalik (${Math.round(mulai)} → ${Math.round(selesai)}): setel data-berangkat/data-tiba`,
                h.el,
                halte[i + 1].el,
              );
            }
          });
        });

        const pusat = (h: Halte) => {
          const r = h.el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        };
        // Ukuran dari offsetWidth/Height: tidak terpengaruh rotasi halte.
        const rupa = (h: Halte) => {
          const w = h.el.offsetWidth;
          const t = h.el.offsetHeight;
          return { w, t, r: h.sudut ?? Math.min(w, t) / 2, putar: h.putar };
        };
        /** Ukuran titik biasa di jalan. */
        const ukuranJalan = () => gsap.utils.clamp(12, 20, window.innerWidth * 0.015);
        const sorot = (i: number, nyala: boolean) =>
          halte[i].el.closest("[data-sorot]")?.toggleAttribute("data-disinggahi", nyala);

        // m: 0 = titik biasa, 1 = bentuk halte `morf.halte`. Tween elastis
        // boleh melampaui 1 (pantulan) atau di bawah 0 (ancang-ancang).
        const morf = { m: 1, halte: 0 };
        const efek = { lompat: 0, tenggelam: 0 };
        const masuk = { v: 0 };
        let aktif: number | null = 0;
        let tweenMorf: gsap.core.Tween | null = null;
        let tlTenggelam: gsap.core.Timeline | null = null;
        let tweenBlok: gsap.core.Tween | null = null;

        // Muncul pertama kali: lingkaran pembuka tumbuh dari nol.
        const tweenMasuk = gsap.to(masuk, { v: 1, duration: 1.3, ease: "expo.out", delay: 0.25 });
        sorot(0, true);

        const ganti = (lama: number | null, baru: number | null) => {
          if (lama !== null) {
            sorot(lama, false);
            if (halte[lama].tenggelam) {
              // Kembali muncul dari dalam blok; blok kembali agak transparan.
              tlTenggelam?.kill();
              tlTenggelam = gsap.timeline().to(efek, {
                tenggelam: 0,
                lompat: 0,
                duration: 0.35,
                ease: "power2.out",
              });
              if (blok) {
                tweenBlok?.kill();
                tweenBlok = gsap.to(blok, { opacity: BLOK_TRANSPARAN, duration: 0.5 });
              }
            }
          }
          tweenMorf?.kill();

          if (baru === null) {
            // Berangkat: ancang-ancang kecil, lalu kembali menjadi titik biasa.
            tweenMorf = gsap.to(morf, { m: 0, duration: 0.45, ease: "back.in(1.8)" });
            return;
          }
          if (halte[baru].tenggelam) {
            // Tiba di blok ajakan: tetap titik biasa, memantul sekali di
            // tepinya, lalu tenggelam; blok menjadi penuh.
            morf.halte = baru;
            morf.m = 0;
            const d = ukuranJalan();
            tlTenggelam?.kill();
            tlTenggelam = gsap
              .timeline()
              .to(efek, { lompat: -d * 2.6, duration: 0.28, ease: "power2.out" })
              .to(efek, { lompat: 0, duration: 0.26, ease: "power2.in" })
              .to(efek, { tenggelam: 1, duration: 0.55, ease: "power2.in" });
            if (blok) {
              tweenBlok?.kill();
              tweenBlok = gsap.to(blok, { opacity: 1, duration: 0.7, delay: 0.55, ease: "power1.out" });
            }
            return;
          }
          // Tiba: titik biasa berubah menjadi bentuk halte, memantul elastis.
          if (morf.halte !== baru) {
            morf.halte = baru;
            morf.m = 0;
          }
          sorot(baru, true);
          tweenMorf = gsap.to(morf, { m: 1, duration: 0.9, ease: "elastic.out(1, 0.45)" });
        };

        const gambar = () => {
          const st = tentukan();
          const baru = st.p === null ? st.i : null;
          if (baru !== aktif) {
            ganti(aktif, baru);
            aktif = baru;
          }

          let x: number;
          let y: number;
          if (st.p === null) {
            ({ x, y } = pusat(halte[st.i]));
          } else {
            const a = pusat(halte[st.i]);
            const b = pusat(halte[st.i + 1]);
            const pp = gsap.parseEase("power2.inOut")(st.p);
            // Lintasan melengkung: titik "melompat", bukan meluncur lurus.
            const jarak = Math.hypot(b.x - a.x, b.y - a.y);
            const lengkung = Math.min(140, jarak * 0.28) * Math.sin(Math.PI * st.p);
            x = campur(a.x, b.x, pp);
            y = campur(a.y, b.y, pp) - lengkung;
          }

          const d = ukuranJalan();
          const s = rupa(halte[morf.halte]);
          const m = morf.m;
          const skala = masuk.v * (1 - efek.tenggelam);
          const w = Math.max(0, campur(d, s.w, m)) * skala;
          const h = Math.max(0, campur(d, s.t, m)) * skala;
          const r = Math.max(0, campur(d / 2, s.r, m)) * skala;
          // Memantul di atas tepi blok, lalu turun masuk ke dalamnya.
          y += efek.lompat + efek.tenggelam * d * 1.4;

          el.style.width = `${w}px`;
          el.style.height = `${h}px`;
          el.style.borderRadius = `${r}px`;
          el.style.transform = `translate3d(${x - w / 2}px, ${y - h / 2}px, 0) rotate(${s.putar * m}deg)`;
        };

        gsap.ticker.add(gambar);
        return () => {
          gsap.ticker.remove(gambar);
          // Tween di bawah dibuat dari dalam ticker (di luar konteks GSAP),
          // jadi tidak ikut dibersihkan otomatis.
          [periksa, tweenMasuk, tweenMorf, tlTenggelam, tweenBlok].forEach((t) => t?.kill());
          halte.forEach((_, i) => sorot(i, false));
          if (blok) gsap.set(blok, { clearProps: "opacity" });
          document.documentElement.removeAttribute("data-pemandu-aktif");
          el.removeAttribute("style");
        };
      },
    );
  });

  return (
    <div
      ref={titik}
      aria-hidden="true"
      data-titik-pemandu
      className="pointer-events-none fixed left-0 top-0 z-30 size-0 bg-ld-red"
    />
  );
}
