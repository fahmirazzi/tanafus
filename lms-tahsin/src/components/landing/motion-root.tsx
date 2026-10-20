"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/**
 * Mask SplitText memakai overflow: clip setinggi line-height. Dengan
 * leading rapat, ekor huruf p, y, g, j terpotong rata, dan mask itu tetap ada
 * setelah animasi selesai. Padding memperluas area klip ke bawah; margin
 * negatif menjaga tata letak tidak bergeser.
 */
function beriRuangEkor(masks: Element[]) {
  gsap.set(masks, { paddingBottom: "0.14em", marginBottom: "-0.14em" });
}

/** Lama satu huruf "dilafalkan" sebelum titik terangkat, dalam detik. */
const BICARA = 3.2;
/** Jumlah "suku kata" gelombang selama satu huruf dilafalkan. */
const LANGKAH_BICARA = 10;
/**
 * Satu putaran penuh per huruf: bicara, lalu ganti huruf dan titik mendarat
 * (1,05 dtk). Loop berikutnya langsung menyambung tanpa jeda.
 */
const SIKLUS = BICARA + 1.05;

/**
 * Satu-satunya client component di halaman depan. Semua markup tetap
 * dirender server (SEO, LCP); komponen ini hanya menambahkan gerak pada
 * elemen bertanda `data-*` di dalam `children`.
 *
 * Setiap animasi punya alasan:
 * - penekanan   : titik merah jatuh memantul ke kata yang ditekankan; saat
 *                 menyentuh, kata berubah warna dan cincin riak menyebar.
 *                 Titik pada judul hero ikut berdenyut setiap kali titik
 *                 huruf di loop mendarat.
 * - titik jatuh : contoh harakat Abu al-Aswad di /tentang, bergiliran.
 * - huruf       : loop huruf hijaiyah. Titik merah (harakat) terangkat saat
 *                 huruf berganti, lalu mendarat di huruf baru. Gelombang suara
 *                 diam selama pergantian dan "berbunyi" saat titik mendarat,
 *                 seolah huruf itu sedang dilafalkan. Label makhraj dan sifat
 *                 huruf muncul satu per satu selama huruf itu tampil. Dijeda
 *                 saat tak terlihat.
 * - kaligrafi   : bergeser pelan saat digulir, memberi kedalaman.
 * - tumpukan    : langkah-langkah memang berurutan; kartu sebelumnya mundur.
 * - muncul      : kartu dan syarat masuk satu per satu.
 * - baris       : masalah dan motto naik per baris, memberi jeda baca.
 * - gulir halus : Lenis, digerakkan ticker GSAP agar ScrollTrigger selaras.
 * - tanya jawab : jawaban membuka dan menutup dengan tinggi yang dianimasikan.
 * - centang     : lingkaran centang syarat guru muncul memantul.
 * - baca        : pernyataan masalah menebal kata demi kata saat digulir.
 * - hitung      : nilai laporan menghitung naik; "0 sesi hangus" menghitung
 *                 mundur ke 0, lalu titik jatuh di atasnya.
 * - tulis       : تَلَقِّي "dituliskan" dari kanan ke kiri, tersambung ke gulir.
 * - langkah     : pesan WhatsApp didahului tanda mengetik; catatan guru
 *                 tertulis kata demi kata.
 * - balap       : titik penekanan motto berlari memantul menuju "terbaik.".
 * - penutup     : kaligrafi ابدأ tumbuh pelan, tombol beriak sekali.
 * - navigasi    : latar dan garis bawah muncul setelah halaman digulir
 *                 (berlaku juga saat gerak dikurangi; ini keadaan, bukan gerak).
 *
 * Semua di dalam gsap.matchMedia: bila pengguna meminta gerak dikurangi,
 * tidak ada satu pun yang berjalan dan halaman tampil statis utuh (huruf
 * pertama, kata tekanan sudah berwarna dan bertitik).
 */
export function MotionRoot({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Khusus development: `/?motion` memaksa animasi walau OS meminta gerak
      // dikurangi. Windows dengan "Animation effects" mati melaporkan
      // prefers-reduced-motion: reduce, dan tanpa ini animasi tidak bisa
      // diperiksa di mesin seperti itu. Dihapus total dari build produksi.
      const paksa =
        process.env.NODE_ENV !== "production" &&
        new URLSearchParams(window.location.search).has("motion");
      const BOLEH_BERGERAK = paksa
        ? "all"
        : "(prefers-reduced-motion: no-preference)";

      // --- Pengukuran tinta huruf hero ------------------------------------
      // Letak titik merah dan label DIUKUR dari batas tinta tiap glif, bukan
      // ditebak: tinggi dan lebar tinta ض, ح, ر, dan م sangat berbeda,
      // sehingga persen tetap membuat titik melayang jauh atau label menutupi
      // huruf. Dipanggil lazily, jadi font sudah termuat dan ukuran layar
      // terbaru ikut terhitung. Koordinat relatif terhadap wadah huruf.
      const kanvas = document.createElement("canvas").getContext("2d");
      const metrik = (el: HTMLElement) => {
        if (!kanvas) return null;
        const cs = getComputedStyle(el);
        const font = (ukuran: number) =>
          `${cs.fontStyle} ${cs.fontWeight} ${ukuran}px ${cs.fontFamily}`;
        kanvas.font = font(parseFloat(cs.fontSize));
        const m = kanvas.measureText(el.textContent ?? "");
        if (!m.fontBoundingBoxAscent) return null;
        // Model kotak baris CSS: area konten (ascent + descent font) berada
        // di tengah line-height, dengan garis dasar di bawah ascent.
        const garisDasar =
          (parseFloat(cs.lineHeight) - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 +
          m.fontBoundingBoxAscent;
        // Teks rata tengah: glif mulai di tengah dikurangi setengah lebarnya.
        const mulai = (el.clientWidth - m.width) / 2;
        return { cs, m, font, garisDasar, mulai };
      };
      const tinta = (el: HTMLElement) => {
        const k = metrik(el);
        if (!k) {
          return {
            kiri: el.offsetLeft,
            atas: el.offsetTop,
            kanan: el.offsetLeft + el.offsetWidth,
            bawah: el.offsetTop + el.offsetHeight,
          };
        }
        return {
          kiri: el.offsetLeft + k.mulai - k.m.actualBoundingBoxLeft,
          atas: el.offsetTop + k.garisDasar - k.m.actualBoundingBoxAscent,
          kanan: el.offsetLeft + k.mulai + k.m.actualBoundingBoxRight,
          bawah: el.offsetTop + k.garisDasar + k.m.actualBoundingBoxDescent,
        };
      };

      /**
       * Peta piksel tinta satu huruf (resolusi setengah), sebagai citra
       * integral: jumlah piksel tinta di dalam kotak mana pun dihitung O(1).
       * Kotak batas tinta saja tidak cukup: sudut kotak ض kosong, tetapi
       * ujung kepalanya justru berada di sisi kanan kotak itu.
       */
      const SKALA_PETA = 0.5;
      const petaTinta = (el: HTMLElement) => {
        const wadah = el.parentElement as HTMLElement;
        const k = metrik(el);
        const W = Math.ceil(wadah.clientWidth * SKALA_PETA);
        const H = Math.ceil(wadah.clientHeight * SKALA_PETA);
        const kanvasPeta = document.createElement("canvas");
        kanvasPeta.width = W;
        kanvasPeta.height = H;
        const c = kanvasPeta.getContext("2d", { willReadFrequently: true });
        const integral = new Int32Array((W + 1) * (H + 1));
        if (c && k && W && H) {
          c.font = k.font(parseFloat(k.cs.fontSize) * SKALA_PETA);
          c.textBaseline = "alphabetic";
          c.fillText(
            el.textContent ?? "",
            (el.offsetLeft + k.mulai) * SKALA_PETA,
            (el.offsetTop + k.garisDasar) * SKALA_PETA,
          );
          const alfa = c.getImageData(0, 0, W, H).data;
          for (let y = 0; y < H; y++) {
            let baris = 0;
            for (let x = 0; x < W; x++) {
              baris += alfa[(y * W + x) * 4 + 3] > 64 ? 1 : 0;
              integral[(y + 1) * (W + 1) + x + 1] = integral[y * (W + 1) + x + 1] + baris;
            }
          }
        }
        // Jumlah piksel tinta di kotak (koordinat wadah, piksel penuh).
        return (x0: number, y0: number, x1: number, y1: number) => {
          const j = (v: number, maks: number) =>
            Math.max(0, Math.min(maks, Math.round(v * SKALA_PETA)));
          const [a, b, c2, d] = [j(x0, W), j(y0, H), j(x1, W), j(y1, H)];
          const n = W + 1;
          return integral[d * n + c2] - integral[b * n + c2] - integral[d * n + a] + integral[b * n + a];
        };
      };

      /**
       * Letak label makhraj/sifat di sekitar huruf. Tiap label punya tempat
       * pilihan (0 kiri atas, 1 kanan di bawah titik merah, 2 kiri bawah);
       * dari semua posisi di dalam kolom hero dipilih yang paling sedikit
       * menutupi tinta huruf, lalu yang terdekat dengan tempat pilihannya.
       * Titik merah dan label sebelumnya menjadi penghalang, dan label tidak
       * pernah turun ke gelombang suara atau keluar kolom (tak ada gulir
       * horizontal di ponsel). Hasil disimpan per huruf dan ukuran wadah.
       */
      /**
       * Tempat mendarat titik merah hero: SATU titik tetap untuk semua huruf,
       * di luar sudut kanan atas gabungan tinta kesepuluh huruf (paling kanan
       * dari huruf terlebar, sedikit di atas puncak huruf tertinggi).
       *
       * Sebelumnya titik diukur dari tinta tiap huruf, sehingga tempatnya
       * melompat-lompat: ط dan ظ tinggi, ر pendek, ض lebar. Kini titik
       * memantul di tempat yang sama setiap kali huruf berganti.
       *
       * PENTING: titik TIDAK boleh duduk tepat di atas huruf. Titik di atas
       * adalah i'jam yang mengubah identitas huruf (ح bertitik terbaca خ, ع
       * terbaca غ, ر terbaca ز). Karena tempatnya di luar gabungan tinta semua
       * huruf, titik tidak pernah berada di atas huruf mana pun.
       *
       * x = pusat titik, y = tepi atas titik (titik memakai -translate-x-1/2).
       */
      const titikTetap = (wadah: HTMLElement, d: number) => {
        let kanan = -Infinity;
        let atas = Infinity;
        wadah.querySelectorAll<HTMLElement>("[data-huruf]").forEach((h) => {
          const t = tinta(h);
          kanan = Math.max(kanan, t.kanan);
          atas = Math.min(atas, t.atas);
        });
        return { x: kanan + d * 0.7, y: atas - d * 0.6 };
      };

      type Kotak = { x0: number; y0: number; x1: number; y1: number };
      const tembus = (a: Kotak, b: Kotak) =>
        a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      const simpananLetak = new Map<string, { x: number; y: number }[]>();
      const letakLabel = (hurufEl: HTMLElement, label: HTMLElement[]) => {
        const wadah = hurufEl.parentElement as HTMLElement;
        const kolom = wadah.parentElement as HTMLElement;
        const kunci = `${hurufEl.textContent}|${wadah.clientWidth}x${wadah.clientHeight}|${kolom.clientWidth}`;
        const tersimpan = simpananLetak.get(kunci);
        if (tersimpan) return tersimpan;

        const t = tinta(hurufEl);
        const hitungTinta = petaTinta(hurufEl);
        const tinggi = t.bawah - t.atas;
        const d = wadah.querySelector<HTMLElement>("[data-hero-dot]")?.offsetHeight ?? 24;
        const JARAK = 8;
        // Titik merah di tempat tetapnya (titikTetap) adalah penghalang.
        const pt = titikTetap(wadah, d);
        const halangan: Kotak[] = [
          {
            x0: pt.x - d / 2 - JARAK,
            y0: pt.y - JARAK,
            x1: pt.x + d / 2 + JARAK,
            y1: pt.y + d + JARAK,
          },
        ];
        const xMin = -wadah.offsetLeft;
        const xMaks = kolom.clientWidth - wadah.offsetLeft;
        const hasil = label.map((l, j) => {
          const w = l.offsetWidth;
          const h = l.offsetHeight;
          const [px, py] =
            j === 0
              ? [t.kiri - w * 0.55, t.atas - h * 0.35]
              : j === 1
                ? [t.kanan - w * 0.35, t.atas + tinggi * 0.35]
                : [t.kiri - w * 0.55, t.atas + tinggi * 0.6];
          // Boleh naik sampai puncak wadah bila perlu melewati titik merah
          // (huruf pendek seperti ر di kolom sempit).
          const yMin = Math.max(Math.min(t.atas - h * 1.1, 0), -h);
          const yMaks = wadah.clientHeight - h;
          let terbaik = { x: gsap.utils.clamp(xMin, xMaks - w, px), y: py };
          let biaya = Infinity;
          for (let y = yMin; y <= yMaks; y += 4) {
            for (let x = xMin; x <= xMaks - w; x += 4) {
              const kotak = { x0: x, y0: y, x1: x + w, y1: y + h };
              if (halangan.some((k) => tembus(k, kotak))) continue;
              // Satu piksel tinta tertutup setara bergeser ~24 px.
              const c =
                hitungTinta(x - 4, y - 4, x + w + 4, y + h + 4) * 24 +
                Math.hypot(x - px, y - py);
              if (c < biaya) {
                biaya = c;
                terbaik = { x, y };
              }
            }
          }
          halangan.push({
            x0: terbaik.x - JARAK,
            y0: terbaik.y - JARAK,
            x1: terbaik.x + w + JARAK,
            y1: terbaik.y + h + JARAK,
          });
          return terbaik;
        });
        simpananLetak.set(kunci, hasil);
        return hasil;
      };
      const labelKelompok = () =>
        gsap.utils
          .toArray<HTMLElement>("[data-label-huruf]", root.current)
          .map((k) => gsap.utils.toArray<HTMLElement>(k.querySelectorAll("[data-label]")));

      // --- Navigasi: transparan di puncak, berlatar setelah digulir ------
      const navigasi = root.current?.querySelector<HTMLElement>("[data-navigasi]");
      if (navigasi) {
        navigasi.setAttribute("data-pantau", "");
        // Dibaca dari posisi gulir, bukan isActive: dengan end "max",
        // isActive padam tepat di dasar halaman dan navigasi kembali
        // transparan di atas blok merah penutup.
        // Tombol WhatsApp mengambang: tampil setelah hero terlewati, sembunyi
        // saat blok ajakan penutup terlihat (di sana sudah ada tombolnya).
        const mengambang = root.current?.querySelector<HTMLElement>("[data-mengambang]");
        const ctaAkhir = root.current?.querySelector<HTMLElement>("[data-cta-akhir]");
        const perbarui = (self: ScrollTrigger) => {
          navigasi.toggleAttribute("data-tergulir", self.scroll() > 8);
          if (mengambang) {
            const kotak = ctaAkhir?.getBoundingClientRect();
            const ctaTerlihat = kotak ? kotak.top < innerHeight && kotak.bottom > 0 : false;
            mengambang.toggleAttribute(
              "data-sembunyi",
              self.scroll() < innerHeight * 0.9 || ctaTerlihat,
            );
          }
        };
        mengambang?.setAttribute("data-sembunyi", "");
        ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: perbarui,
          onRefresh: perbarui,
        });
      }

      // Gerak dikurangi: label huruf pertama tampil diam di tempatnya.
      mm.add(paksa ? "not all" : "(prefers-reduced-motion: reduce)", () => {
        const pertama = root.current?.querySelector<HTMLElement>("[data-huruf]");
        const label = labelKelompok()[0];
        if (!pertama || !label?.length) return;
        const titikDiam = root.current?.querySelector<HTMLElement>("[data-hero-dot]");
        const tempatkan = () => {
          const wadah = pertama.parentElement as HTMLElement;
          if (titikDiam) {
            const pt = titikTetap(wadah, titikDiam.offsetHeight);
            gsap.set(titikDiam, { left: 0, top: 0, x: pt.x, y: pt.y });
          }
          letakLabel(pertama, label).forEach((p, j) =>
            gsap.set(label[j], { x: p.x, y: p.y, opacity: 1 }),
          );
        };
        // Tunggu font: ukuran tinta dari font cadangan jauh berbeda.
        document.fonts.ready.then(tempatkan);
        window.addEventListener("resize", tempatkan);
        return () => window.removeEventListener("resize", tempatkan);
      });

      mm.add(BOLEH_BERGERAK, () => {
        const q = <T extends Element = HTMLElement>(s: string) =>
          root.current?.querySelector<T>(s) ?? null;
        const semua = <T extends Element = HTMLElement>(s: string) =>
          gsap.utils.toArray<T>(s);

        // --- Gulir halus (Lenis) ------------------------------------------
        // Lenis tetap memakai gulir asli browser (position: sticky tetap
        // bekerja, beda dengan ScrollSmoother), hanya menghaluskan rodanya.
        // Digerakkan ticker GSAP, bukan rAF sendiri, supaya ScrollTrigger dan
        // Lenis membaca posisi gulir pada frame yang sama.
        const lenis = new Lenis({
          lerp: 0.1,
          // Tautan #guru dan sejenisnya ikut digulir halus. Ruang untuk
          // navigasi sticky datang dari scroll-margin-top bagian tujuan
          // (scroll-mt-24), yang dihormati Lenis; jangan tambah offset lagi.
          anchors: true,
          autoRaf: false,
        });
        lenis.on("scroll", ScrollTrigger.update);
        const detakLenis = (waktu: number) => lenis.raf(waktu * 1000);
        gsap.ticker.add(detakLenis);
        gsap.ticker.lagSmoothing(0);

        // --- Hero: intro sekali -------------------------------------------
        // CSS menyembunyikan [data-hero] sebelum hydration (globals.css).
        // Semua tween memakai fromTo dengan nilai akhir eksplisit: `from`
        // akan membaca opacity 0 dari CSS sebagai nilai akhirnya.
        gsap.set("[data-hero]", { opacity: 1 });

        // Setiap langkah hanya ditambahkan bila elemennya ada: beranda dan
        // /tentang memakai intro yang sama, dan target kosong membuat GSAP
        // mengeluarkan peringatan di konsol.
        const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
        const barisJudul = semua("[data-hero-line]");
        if (barisJudul.length) {
          intro.fromTo(
            barisJudul,
            { yPercent: 115 },
            { yPercent: 0, duration: 1.1, stagger: 0.1 },
            0.1,
          );
        } else if (q("h1[data-hero]")) {
          intro.fromTo(
            "h1[data-hero]",
            { opacity: 0, y: 36 },
            { opacity: 1, y: 0, duration: 1.1 },
            0.1,
          );
        }
        if (semua("[data-hero-fade]").length) {
          intro.fromTo(
            "[data-hero-fade]",
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 },
            0.55,
          );
        }
        if (q("[data-hero-letter]")) {
          intro.fromTo(
            "[data-hero-letter]",
            { opacity: 0, scale: 0.94 },
            { opacity: 1, scale: 1, duration: 1.2 },
            0.3,
          );
        }

        // --- Penekanan kata: titik jatuh, kata berubah warna, riak ---------
        // Kata mula-mula berwarna seperti teks sekitarnya (atribut
        // data-tekanan-awal, lihat globals.css). Titik jatuh memantul; pada
        // sentuhan pertama bounce (~0,3 dtk) atribut dilepas sehingga warna
        // beralih lewat transisi CSS, dan cincin riak menyebar dari titik.
        const tekananHero = q("[data-hero] [data-tekanan]");
        semua<HTMLElement>("[data-tekanan]").forEach((el) => {
          const titikKata = el.querySelector("[data-tekanan-titik]");
          const riak = el.querySelector("[data-tekanan-riak]");
          if (!titikKata || !riak) return;
          const ukuranHuruf = () => parseFloat(getComputedStyle(el).fontSize);
          el.setAttribute("data-tekanan-awal", "");
          const balap = el.closest<HTMLElement>("[data-balap]");
          const jatuh = gsap.timeline({ paused: true });
          let sentuh: number;
          if (balap) {
            // Motto "Berlomba menuju bacaan terbaik.": titik tidak jatuh dari
            // atas, tetapi berlari memantul di atas kata-kata dari awal baris
            // menuju "terbaik.", seperti bola pengiring bacaan. Awal baris
            // diukur dari kotak baris teks (Range), karena judul bisa pecah
            // menjadi dua baris dengan letak berbeda di tiap layar.
            const awalX = () => {
              const kotakTitik = (titikKata.parentElement as HTMLElement).getBoundingClientRect();
              const kata = el.getBoundingClientRect();
              const r = document.createRange();
              r.selectNodeContents(balap);
              const kiriBaris = Math.min(
                kata.left,
                ...[...r.getClientRects()]
                  .filter((b) => b.width > 0 && b.bottom > kata.top + 2 && b.top < kata.bottom - 2)
                  .map((b) => b.left),
              );
              return kiriBaris - kotakTitik.left;
            };
            const LARI = 1.7;
            const LOMPAT = 10;
            gsap.set(titikKata, { opacity: 0 });
            jatuh
              .fromTo(
                titikKata,
                { x: awalX, y: 0, scale: 0.35, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2)", immediateRender: false },
                0.5,
              )
              .to(titikKata, { x: 0, duration: LARI, ease: "power1.inOut" }, 0.7)
              // Jumlah setengah-lompatan genap: lompatan terakhir mendarat di y 0.
              .fromTo(
                titikKata,
                { y: 0 },
                {
                  y: () => -0.45 * ukuranHuruf(),
                  duration: LARI / LOMPAT,
                  ease: "power1.out",
                  repeat: LOMPAT - 1,
                  yoyo: true,
                  immediateRender: false,
                },
                0.7,
              );
            sentuh = 0.7 + LARI;
          } else {
            jatuh.fromTo(
              titikKata,
              { y: () => -1.5 * ukuranHuruf(), scale: 0.35, opacity: 0 },
              { y: 0, scale: 1, opacity: 1, duration: 1.15, ease: "bounce.out" },
            );
            // Sentuhan pertama bounce.out jatuh di ~36% durasi (1,15 x 0,36).
            sentuh = 0.42;
          }
          jatuh
            .call(() => el.removeAttribute("data-tekanan-awal"), undefined, sentuh)
            .fromTo(
              riak,
              { scale: 1, opacity: 0.85 },
              {
                scale: 3.4,
                opacity: 0,
                duration: 1.5,
                ease: "power2.out",
                // Tanpa ini riak langsung tampil (opacity 0.85) saat
                // timeline dibuat, sebelum titiknya jatuh.
                immediateRender: false,
              },
              sentuh,
            );
          if (el === tekananHero) {
            intro.add(() => {
              jatuh.play();
            }, 0.95);
          } else {
            ScrollTrigger.create({
              trigger: el,
              start: "top 82%",
              once: true,
              onEnter: () => {
                jatuh.play();
              },
            });
          }
        });

        // --- Titik harakat yang jatuh ke huruf (halaman /tentang) ---------
        // Dikelompokkan per daftar: dalam satu daftar titik jatuh bergiliran.
        const kelompokJatuh = new Map<Element, HTMLElement[]>();
        semua<HTMLElement>("[data-jatuh]").forEach((el) => {
          const kelompok = el.closest("ul") ?? el;
          kelompokJatuh.set(kelompok, [...(kelompokJatuh.get(kelompok) ?? []), el]);
        });
        kelompokJatuh.forEach((els, kelompok) => {
          gsap.set(els, { opacity: 0, y: -70, scale: 0.4 });
          ScrollTrigger.create({
            trigger: kelompok,
            start: "top 72%",
            once: true,
            onEnter: () => {
              gsap.to(els, {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.85,
                ease: "bounce.out",
                stagger: 0.4,
              });
            },
          });
        });

        // --- Hero: loop huruf + titik + gelombang --------------------------
        const wadah = q("[data-hero-letter]");
        const titik = q("[data-hero-dot]");
        const huruf = semua<HTMLElement>("[data-huruf]");
        const batang = semua<HTMLElement>("[data-wave] > span");
        const kelompokLabel = labelKelompok();

        if (wadah && titik && huruf.length > 1 && batang.length) {
          // Tempat yang sama untuk setiap huruf (lihat titikTetap).
          const ukur = () => titikTetap(wadah, titik.offsetHeight);

          // Tanpa JS titik memakai left/top persen dari CSS; dengan JS titik
          // ditaruh di pojok kotak huruf lalu digeser dengan transform.
          gsap.set(titik, { left: 0, top: 0, opacity: 0 });
          intro.fromTo(
            titik,
            { x: () => ukur().x, y: () => ukur().y - 80, scale: 0.4 },
            {
              x: () => ukur().x,
              y: () => ukur().y,
              opacity: 1,
              scale: 1,
              duration: 0.9,
              ease: "back.out(2.2)",
              immediateRender: false,
            },
            0.85,
          );

          const gelombang = q("[data-wave]");
          const titikJudul = tekananHero?.querySelector("[data-tekanan-titik]");
          const riakJudul = tekananHero?.querySelector("[data-tekanan-riak]");
          // SENGAJA tidak dibungkus contextSafe. Dipanggil dari call() di
          // dalam konteks matchMedia, contextSafe dari konteks luar membuat
          // konteks saling merujuk: saat preferensi gerak berubah di tengah
          // jalan, revert berakhir "Maximum call stack size exceeded".
          // Tween di sini paling lama 1,3 detik, jadi tak perlu dilacak.
          const berbunyi = () => {
            if (gelombang) {
              gelombang.setAttribute("data-berbunyi", "");
              gsap.delayedCall(1.1, () =>
                gelombang.removeAttribute("data-berbunyi"),
              );
            }
            if (titikJudul && riakJudul) {
              gsap.fromTo(
                titikJudul,
                { scale: 1.35 },
                { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.45)" },
              );
              gsap.fromTo(
                riakJudul,
                { scale: 1, opacity: 0.6 },
                { scale: 3.4, opacity: 0, duration: 1.3, ease: "power2.out" },
              );
            }
          };

          const loop = gsap.timeline({
            repeat: -1,
            repeatRefresh: true,
            paused: true,
          });

          huruf.forEach((el, i) => {
            const j = (i + 1) % huruf.length;
            const t = i * SIKLUS;

            // 1. Huruf "dilafalkan": gelombang bergerak acak, suku kata demi
            //    suku kata. Sengaja langkah terpisah, BUKAN satu tween dengan
            //    repeat + stagger: repeat mengulang seluruh urutan stagger,
            //    sehingga fase bicara jauh melampaui BICARA dan loop tersendat
            //    lama di sambungan.
            const langkah = BICARA / LANGKAH_BICARA;
            for (let k = 0; k < LANGKAH_BICARA; k++) {
              loop.to(
                batang,
                {
                  // Bergantian tinggi dan rendah, seperti tekanan suku kata.
                  scaleY: k % 2 ? "random(0.3, 0.85)" : "random(0.6, 1.35)",
                  duration: langkah * 0.8,
                  ease: "sine.inOut",
                  stagger: { amount: langkah * 0.2, from: "random" },
                },
                t + k * langkah,
              );
            }
            // Label makhraj dan sifat muncul satu per satu, lalu pergi
            // sebelum titik terangkat.
            const label = kelompokLabel[i] ?? [];
            if (label.length) {
              const letak = (k: number) => letakLabel(el, label)[k];
              loop.fromTo(
                label,
                {
                  opacity: 0,
                  x: (k: number) => letak(k).x,
                  y: (k: number) => letak(k).y + 10,
                  scale: 0.7,
                },
                {
                  opacity: 1,
                  x: (k: number) => letak(k).x,
                  y: (k: number) => letak(k).y,
                  scale: 1,
                  duration: 0.5,
                  ease: "back.out(1.8)",
                  stagger: 0.14,
                  immediateRender: false,
                },
                t + 0.05,
              );
              loop.to(
                label,
                {
                  opacity: 0,
                  y: "-=6",
                  scale: 0.96,
                  duration: 0.3,
                  ease: "power2.in",
                  stagger: 0.05,
                },
                t + BICARA - 0.4,
              );
            }
            // 2. Jeda napas: gelombang merendah, titik terangkat melayang.
            loop.to(
              batang,
              {
                scaleY: 0.18,
                duration: 0.35,
                ease: "power2.out",
                stagger: { each: 0.004, from: "edges" },
              },
              t + BICARA,
            );
            loop.to(
              titik,
              {
                x: () => ukur().x,
                y: () => ukur().y - 72,
                scale: 0.8,
                duration: 0.45,
                ease: "power2.out",
              },
              t + BICARA,
            );
            // 3. Huruf berganti.
            loop.to(
              el,
              { opacity: 0, scale: 0.9, duration: 0.4, ease: "power2.in" },
              t + BICARA + 0.05,
            );
            loop.fromTo(
              huruf[j],
              { opacity: 0, scale: 1.1 },
              {
                opacity: 1,
                scale: 1,
                duration: 0.6,
                ease: "expo.out",
                // Wajib false: fromTo di timeline langsung menerapkan nilai
                // awalnya saat timeline DIBUAT. Transisi terakhir (ke huruf
                // pertama) akan menyetel huruf pertama ke opacity 0 sebelum
                // loop mulai, dan huruf itu tak terlihat di putaran pertama.
                immediateRender: false,
              },
              t + BICARA + 0.4,
            );
            // 4. Titik mendarat di huruf baru, disusul bunyi pertama.
            loop.to(
              titik,
              {
                x: () => ukur().x,
                y: () => ukur().y,
                scale: 1,
                duration: 0.6,
                ease: "back.out(2.6)",
              },
              t + BICARA + 0.45,
            );
            loop.to(
              batang,
              {
                scaleY: "random(0.8, 1.45)",
                duration: 0.18,
                ease: "power3.out",
                stagger: { each: 0.004, from: "center" },
              },
              t + BICARA + 0.65,
            );
            // Sinkron saat titik huruf mendarat (huruf baru "dilafalkan"):
            // - batang tengah gelombang memerah sejenak, menekankan bunyinya;
            // - titik pada kata yang ditekankan di judul berdenyut dan beriak.
            // Lewat call() berdurasi nol, BUKAN tween di dalam loop: efek yang
            // lebih panjang dari sisa putaran akan memperpanjang timeline dan
            // membuat sambungan loop tersendat di huruf terakhir.
            loop.call(berbunyi, undefined, t + BICARA + 0.65);
          });

          // Loop mulai setelah intro, dan dijeda saat hero tidak terlihat:
          // animasi tanpa henti yang tak tampak tetap memakan CPU di ponsel.
          let introSelesai = false;
          let terlihat = true;
          intro.eventCallback("onComplete", () => {
            introSelesai = true;
            if (terlihat) loop.play();
          });
          ScrollTrigger.create({
            trigger: wadah,
            start: "top bottom",
            end: "bottom top",
            onToggle: (self) => {
              terlihat = self.isActive;
              if (!introSelesai) return;
              if (self.isActive) loop.play();
              else loop.pause();
            },
          });
        }

        // --- Kaligrafi latar: parallax pelan ------------------------------
        semua<HTMLElement>("[data-decor]").forEach((el) => {
          gsap.fromTo(
            el,
            { yPercent: 12 },
            {
              yPercent: -12,
              ease: "none",
              scrollTrigger: {
                trigger: el.parentElement,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          );
        });

        // --- Muncul saat masuk layar ---------------------------------------
        semua<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 48,
            duration: 1.05,
            ease: "expo.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        });

        // --- Pernyataan besar (masalah, motto): baris demi baris ----------
        semua<HTMLElement>("[data-lines]").forEach((el) => {
          SplitText.create(el, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) => {
              beriRuangEkor(self.masks);
              return gsap.from(self.lines, {
                yPercent: 105,
                duration: 1,
                ease: "expo.out",
                stagger: 0.08,
                scrollTrigger: { trigger: el, start: "top 86%", once: true },
              });
            },
          });
        });

        // --- Masalah: baca bersama ----------------------------------------
        // Tiap pernyataan naik per baris, lalu kata demi kata menebal dari
        // abu-abu ke hitam, tersambung ke gulir, seperti mengikuti bacaan.
        // Opacity, bukan warna: nilai var(--ld-*) tidak bisa di-tween, dan
        // opacity tetap benar saat tema berganti.
        semua<HTMLElement>("[data-baca]").forEach((el) => {
          let baca: gsap.core.Tween | undefined;
          SplitText.create(el, {
            type: "lines,words",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) => {
              beriRuangEkor(self.masks);
              baca?.scrollTrigger?.kill();
              baca?.kill();
              gsap.set(el, { color: "var(--ld-ink)" });
              baca = gsap.fromTo(
                self.words,
                { opacity: 0.32 },
                {
                  opacity: 1,
                  ease: "none",
                  stagger: 0.15,
                  scrollTrigger: {
                    trigger: el,
                    start: "top 72%",
                    end: "bottom 42%",
                    scrub: 0.6,
                  },
                },
              );
              return gsap.from(self.lines, {
                yPercent: 105,
                duration: 1,
                ease: "expo.out",
                stagger: 0.08,
                scrollTrigger: { trigger: el, start: "top 86%", once: true },
              });
            },
          });
        });

        // --- Nilai laporan: menghitung naik ------------------------------
        // Server merender angka akhirnya (tanpa JS tetap benar); di sini
        // angka diturunkan ke 0 lalu dihitung naik saat terlihat.
        const pulihkanAngka: (() => void)[] = [];
        semua<HTMLElement>("[data-hitung]").forEach((el, i) => {
          const akhir = parseInt(el.textContent ?? "", 10);
          if (Number.isNaN(akhir)) return;
          const n = { v: 0 };
          el.textContent = "0";
          pulihkanAngka.push(() => {
            el.textContent = String(akhir);
          });
          gsap.to(n, {
            v: akhir,
            duration: 1.6,
            delay: i * 0.12,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = String(Math.round(n.v));
            },
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        });

        // --- "0 sesi hangus": hitung mundur, lalu titik jatuh -------------
        const nol = q("[data-hitung-mundur]");
        const titikNol = q("[data-titik-nol]");
        if (nol && titikNol) {
          const n = { v: 9 };
          nol.textContent = "9";
          pulihkanAngka.push(() => {
            nol.textContent = "0";
          });
          gsap.set(titikNol, { opacity: 0 });
          gsap
            .timeline({
              scrollTrigger: { trigger: nol, start: "top 85%", once: true },
            })
            .to(n, {
              v: 0,
              duration: 1.4,
              ease: "power3.out",
              onUpdate: () => {
                nol.textContent = String(Math.round(n.v));
              },
            })
            .fromTo(
              titikNol,
              { opacity: 0, y: () => -8 * titikNol.offsetHeight },
              { opacity: 1, y: 0, duration: 0.9, ease: "bounce.out" },
              "-=0.15",
            );
        }

        // --- Kartu langkah 1: "sedang mengetik", lalu pesannya ------------
        semua<HTMLElement>("[data-pesan]").forEach((fig) => {
          const mengetik = fig.querySelector<HTMLElement>("[data-mengetik]");
          const isi = fig.querySelector<HTMLElement>("[data-pesan-isi]");
          if (!mengetik || !isi) return;
          const kata = SplitText.create(isi, { type: "words" }).words;
          gsap.set(kata, { opacity: 0 });
          gsap
            .timeline({
              scrollTrigger: { trigger: fig, start: "top 70%", once: true },
            })
            .set(mengetik, { opacity: 1 })
            .fromTo(
              mengetik.children,
              { y: 0 },
              {
                y: -6,
                duration: 0.28,
                ease: "sine.inOut",
                // repeat di dalam stagger: tiap titik memantul sendiri.
                stagger: { each: 0.12, repeat: 3, yoyo: true },
              },
            )
            .to(mengetik, { opacity: 0, duration: 0.2 })
            .to(kata, { opacity: 1, duration: 0.3, ease: "none", stagger: 0.035 });
        });

        // --- Kartu langkah 3: catatan guru tertulis kata demi kata -------
        semua<HTMLElement>("[data-catatan]").forEach((el) => {
          const kata = SplitText.create(el, { type: "words" }).words;
          gsap.fromTo(
            kata,
            { opacity: 0, y: 6 },
            {
              opacity: 1,
              y: 0,
              duration: 0.35,
              ease: "power1.out",
              stagger: 0.05,
              scrollTrigger: { trigger: el, start: "top 72%", once: true },
            },
          );
        });

        // --- Penutup: kaligrafi tumbuh, tombol beriak sekali --------------
        const penutup = q("#mulai");
        const kaligrafiPenutup = q("#mulai [data-decor]");
        if (penutup && kaligrafiPenutup) {
          // from(): opacity akhirnya dibaca dari kelas (0,12), bukan 1.
          gsap.from(kaligrafiPenutup, {
            opacity: 0,
            scale: 0.82,
            duration: 2.4,
            ease: "expo.out",
            scrollTrigger: { trigger: penutup, start: "top 75%", once: true },
          });
        }
        const riakTombol = semua<HTMLElement>("[data-riak-tombol]");
        if (riakTombol.length) {
          // Tepi cincin digeser (bukan di-scale), supaya tebal garisnya
          // tetap 2px dan jaraknya sama di sisi panjang maupun pendek.
          gsap.fromTo(
            riakTombol,
            { top: 0, right: 0, bottom: 0, left: 0, opacity: 0.85 },
            {
              top: -22,
              right: -22,
              bottom: -22,
              left: -22,
              opacity: 0,
              // Cincin tetap tak terlihat (opacity-0) sampai riaknya dimulai.
              immediateRender: false,
              duration: 1.5,
              ease: "power2.out",
              stagger: 0.35,
              delay: 0.7,
              scrollTrigger: { trigger: riakTombol[0], start: "top 88%", once: true },
            },
          );
        }

        // --- Centang syarat guru: muncul memantul -------------------------
        semua<HTMLElement>("[data-centang]").forEach((el) => {
          gsap.fromTo(
            el,
            { scale: 0, rotate: -40 },
            {
              scale: 1,
              rotate: 0,
              duration: 0.8,
              ease: "back.out(2.6)",
              delay: 0.2,
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            },
          );
        });

        // --- Tanya jawab: buka/tutup beranimasi ---------------------------
        // Klik ringkasan dicegat: saat membuka, <details> dibuka dulu lalu
        // tingginya tumbuh dari 0; saat menutup, tinggi menyusut dulu baru
        // <details> ditutup. Setelah selesai inline style dibersihkan, jadi
        // pembukaan asli browser (mis. Ctrl+F) tetap bekerja normal.
        const lepasFaq: (() => void)[] = [];
        semua<HTMLDetailsElement>("details[data-faq]").forEach((d) => {
          const ringkasan = d.querySelector("summary");
          const isi = d.querySelector<HTMLElement>("[data-faq-isi]");
          if (!ringkasan || !isi) return;
          const teks = isi.firstElementChild;
          let tween: gsap.core.Timeline | null = null;
          const klik = (e: MouseEvent) => {
            e.preventDefault();
            tween?.kill();
            const menutup = d.open && !d.hasAttribute("data-menutup");
            if (menutup) {
              d.setAttribute("data-menutup", "");
              tween = gsap
                .timeline({
                  onComplete: () => {
                    d.open = false;
                    d.removeAttribute("data-menutup");
                    gsap.set([isi, teks], { clearProps: "all" });
                    ScrollTrigger.refresh();
                  },
                })
                .to(teks, { opacity: 0, y: -6, duration: 0.2, ease: "power1.in" })
                .to(isi, { height: 0, duration: 0.45, ease: "power3.inOut" }, 0.05);
            } else {
              // Dibuka lagi di tengah animasi tutup: lanjut dari tinggi saat ini.
              const tinggiAwal = d.hasAttribute("data-menutup") ? isi.offsetHeight : 0;
              d.removeAttribute("data-menutup");
              d.open = true;
              tween = gsap
                .timeline({
                  onComplete: () => {
                    gsap.set([isi, teks], { clearProps: "all" });
                    ScrollTrigger.refresh();
                  },
                })
                .fromTo(
                  isi,
                  { height: tinggiAwal },
                  { height: "auto", duration: 0.6, ease: "expo.out" },
                )
                .fromTo(
                  teks,
                  { opacity: 0, y: 14 },
                  { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
                  0.08,
                );
            }
          };
          ringkasan.addEventListener("click", klik);
          lepasFaq.push(() => ringkasan.removeEventListener("click", klik));
        });

        // Bila matchMedia berbalik (mis. pengguna menyalakan "kurangi gerak"
        // di tengah jalan), revert GSAP tidak menyentuh atribut ini: tanpa
        // pembersihan, kata yang belum sempat dianimasikan tertinggal
        // berwarna seperti teks biasa.
        return () => {
          semua<HTMLElement>("[data-tekanan-awal]").forEach((el) =>
            el.removeAttribute("data-tekanan-awal"),
          );
          q("[data-wave]")?.removeAttribute("data-berbunyi");
          lepasFaq.forEach((lepas) => lepas());
          pulihkanAngka.forEach((pulihkan) => pulihkan());
          semua<HTMLElement>("details[data-menutup]").forEach((d) =>
            d.removeAttribute("data-menutup"),
          );
          gsap.ticker.remove(detakLenis);
          lenis.destroy();
        };
      });

      // --- Talaqqi ditulis dari kanan ke kiri, tersambung ke gulir ---------
      // Di layar lebar kata ini menempel (sticky) di kiri, jadi tulisannya
      // mengikuti pembacaan ketiga poin di kanan. Di ponsel kata berada di
      // atas poin, jadi tulisannya selesai saat kata itu sendiri melintas.
      mm.add(
        { gerak: BOLEH_BERGERAK, lebar: "(min-width: 768px)" },
        (konteks) => {
          const { gerak, lebar } = konteks.conditions as { gerak: boolean; lebar: boolean };
          const tulis = root.current?.querySelector<HTMLElement>("[data-tulis]");
          const poin = root.current?.querySelector<HTMLElement>("[data-talaqqi-poin]");
          if (!gerak || !tulis || !poin) return;
          // Arah RTL: batas kiri klip menyusut dari 110% ke -10%, jadi yang
          // tampil lebih dulu adalah huruf paling kanan.
          gsap.fromTo(
            tulis,
            { clipPath: "inset(-30% -10% -30% 110%)" },
            {
              clipPath: "inset(-30% -10% -30% -10%)",
              ease: "none",
              scrollTrigger: lebar
                ? { trigger: poin, start: "top 65%", end: "bottom 75%", scrub: 0.8 }
                : { trigger: tulis, start: "top 88%", end: "top 45%", scrub: 0.8 },
            },
          );
        },
      );

      // --- Tumpukan kartu: hanya layar lebar --------------------------------
      // Di ponsel kartu cukup bertumpuk biasa; efek kedalaman menambah kerja
      // GPU tanpa menambah pemahaman di layar sekecil itu.
      mm.add(
        paksa
          ? "(min-width: 768px)"
          : "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const cards = gsap.utils.toArray<HTMLElement>("[data-stack-card]");
          cards.forEach((card, i) => {
            const next = cards[i + 1];
            if (!next) return;
            // Hanya scale. Opacity < 1 membuat kartu tembus pandang dan teks
            // semua kartu di bawahnya ikut terlihat bertumpuk.
            gsap.to(card, {
              scale: 0.94,
              ease: "none",
              scrollTrigger: {
                trigger: next,
                start: "top bottom",
                end: "top 20%",
                scrub: true,
              },
            });
          });
        },
      );
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
