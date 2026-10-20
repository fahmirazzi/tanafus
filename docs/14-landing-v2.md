# Halaman Depan v2 → Brand v2 Tanafus

> **Status (2026-09-30): dokumen ini adalah acuan desain yang berlaku.**
> Awalnya redesign halaman depan "tanpa brand" (2026-09-29). Sejak
> pembaruan 11, desain ini menjadi **brand v2 untuk seluruh aplikasi**, dan
> brand v1 ([11-brand-guidelines.md](11-brand-guidelines.md)) sebagian besar
> pensiun. Copy halaman depan yang berlaku ada di
> [16-landing-v3-copy.md](16-landing-v3-copy.md); bagian copy v2 di dokumen ini
> hanya catatan sejarah.

Redesign 2026-09-29. Awalnya sengaja di luar brand Tanafus: owner memutuskan
membiarkan skill desain (`design-taste-frontend`, `high-end-visual-design`,
GSAP) memberi perspektif segar lebih dulu.

- Kode: `lms-tahsin/src/app/page.tsx`, `src/components/landing/`
- Token: `--tf-*` (seluruh aplikasi) dan `--ld-*` (komponen halaman publik),
  keduanya di `src/app/globals.css`
- Versi berbasis brand v1: `docs/archive/landing-v1-brand/`

**Yang tetap dijaga walau brand dikesampingkan:** fakta layanan harus benar,
dan setiap klaim sejarah atau keagamaan harus bersumber.

---

## Arah desain

**Design read:** halaman layanan konsumen untuk orang tua Muslim Indonesia,
bahasa Awwwards tapi *trust-first*, Tailwind v4 + GSAP, sans display dengan
pasangan huruf Arab klasik.

**Dial:** `DESIGN_VARIANCE 8 / MOTION_INTENSITY 7 / VISUAL_DENSITY 3`. Preset
*premium consumer* didorong ke arah Awwwards, tapi tidak sampai 9-10: skill
menetapkan audiens anak-anak dan *trust-first* mengalahkan selera estetika.

### Konsep: titik merah

Menurut riwayat, lebih dari 1.300 tahun lalu sebuah kesalahan bacaan mengubah
makna ayat, lalu Abu al-Aswad ad-Du'ali (w. 69 H / 688 M) menandai mushaf dengan
**titik merah** sebagai tanda harakat, supaya setiap huruf dibaca benar.
Tahsin menjaga hal yang sama. Seluruh halaman dibangun dari itu:

- **Warna aksen** = merah titik harakat itu.
- **Hero** = huruf ض (huruf yang membuat bahasa Arab disebut *lughat aḍ-ḍād*)
  dengan satu titik merah di atasnya: fathah dalam sistem Abu al-Aswad.
- **Merek** = "Tanafus" diikuti titik merah.

Sumber: [Abu al-Aswad ad-Du'ali, Wikipedia](https://en.wikipedia.org/wiki/Abu_al-Aswad_ad-Du'ali).
Kalimat di halaman memakai "menurut riwayat" karena detail kisahnya berupa
riwayat, bukan catatan tunggal yang pasti.

### Palet (semua pasangan diukur WCAG, bukan dikira-kira)

| Token | Terang | Gelap | Kontras |
|---|---|---|---|
| paper | `#F4F4F1` | `#121211` | latar |
| ink | `#141413` | `#ECECE8` | 16,7:1 / 15,8:1 |
| muted | `#5B5B56` | `#A6A6A0` | 6,2:1 / 7,7:1 |
| red | `#C8261B` | `#FF5A4A` | 5,08:1 / 6,1:1 dua arah |

Sengaja **bukan** krem + kuningan (larangan palet "premium-consumer" skill),
bukan hijau + emas (klise situs Islami), bukan ungu AI.

### Tipografi

- **Plus Jakarta Sans**: dirancang Tokotype, foundry Indonesia, untuk
  identitas kota Jakarta. Pilihan yang punya alasan untuk layanan keluarga
  Indonesia.
- **Amiri**: naskh klasik, hanya untuk huruf Arab berukuran besar.
- Tidak ada serif Latin (aturan *serif discipline* skill).

### Susunan (7 keluarga tata letak, tidak ada yang berulang)

1. Hero terbelah 7/5: teks kiri, ض + gelombang suara kanan
2. Manifesto sejarah: paragraf besar yang "tertinta" saat digulir
3. Cara kerja: tumpukan kartu *sticky* (4 langkah)
4. Empat kriteria: bento 4 sel dengan latar berbeda
5. Janji: pernyataan besar selang-seling kiri/kanan
6. Tanya jawab: akordeon tanpa JS (`<details>`)
7. Penutup: satu blok merah

---

## Gerak

Semua di `src/components/landing/motion-root.tsx`, satu-satunya client
component; markup tetap dirender server. Setiap animasi punya alasan:

| Animasi | Alasan |
|---|---|
| Judul hero naik dari mask baris | urutan baca |
| ض muncul, lalu titik merah "jatuh" ke tempatnya | cerita halaman dalam satu detik |
| Gelombang suara berdenyut | tahsin adalah suara; dijeda saat tak terlihat |
| Paragraf sejarah tertinta kata demi kata | dibaca pelan, sesuai isinya |
| Kartu langkah menumpuk, yang lama mengecil | urutan yang memang berurutan |
| Bento dan janji masuk satu per satu | dibaca satu per satu |

**`prefers-reduced-motion: reduce` mematikan semuanya.** Halaman tampil
statis dan utuh (terverifikasi).

> ⚠️ **Windows dengan "Animation effects" dimatikan melaporkan reduce.** Di
> mesin seperti itu tidak ada animasi yang terlihat, dan itu benar, bukan
> rusak. Untuk memeriksa animasi di development: buka **`/?motion`**. Paksaan
> ini dihapus total dari build produksi.

---

## Hasil verifikasi (2026-09-29)

Diperiksa lewat Chrome headless (CDP), bukan hanya dibaca kodenya:

- Animasi benar-benar berjalan: titik merah selesai di posisi akhir, gelombang
  berosilasi, paragraf terbelah 31 kata, judul terbelah per baris.
- Nol error konsol, nol exception, di 14 tangkapan layar.
- Judul hero 2 baris pada 1024, 1280, 1440 px.
- Hero muat satu layar; CTA terlihat tanpa menggulir di desktop dan ponsel.
- Tanpa scroll horizontal di 320, 390, 1024, 1280 px.
- Tidak ada teks di bawah 16 px di `<main>` pada ponsel.
- Terang dan gelap sama-sama diperiksa.
- Nol em-dash/en-dash (diperiksa per code point, bukan per byte).

Cacat yang ditemukan dan diperbaiki saat verifikasi:

1. **Ekor huruf (p, y, g) terpotong.** Mask baris SplitText memakai
   `overflow: clip` setinggi line-height 1,04. Diberi `padding-bottom: 0.14em`.
2. **Tumpukan kartu tembus pandang.** Kartu lama diberi opacity 0,55, sehingga
   teks semua kartu di bawahnya ikut terlihat. Sekarang hanya scale.
3. Judul hero 3 baris di 1024 px, lalu ukuran per breakpoint diukur ulang.
4. Tombol nav di ponsel: "Masuk" disembunyikan (ada di footer), CTA tetap
   tampil kecuali di bawah 360 px.

---

## Penyimpangan dari skill (disengaja)

- **Tidak ada gambar hasil AI**, padahal skill mewajibkan generator gambar bila
  tersedia (Canva tersedia). Alasannya: foto AI akan menampilkan guru dan murid
  yang tidak ada, dan AI menggambar tulisan Arab sebagai coretan yang *terlihat*
  seperti mushaf. Di halaman tentang bacaan Al-Qur'an yang benar, mushaf palsu
  adalah kesalahan terburuk. Visual halaman dibawa oleh tipografi.
- **`lucide-react` dipakai** (satu ikon, `Plus`). Skill tidak menyarankannya,
  kecuali proyek sudah bergantung padanya, dan proyek ini memang begitu.
- **Kartu pratinjau (OG) tanpa huruf Arab.** Satori tidak melakukan shaping
  Arab dan menolak Noto Naskh Arabic
  (`lookupType: 5 - substFormat: 3 is not yet supported`).

---

## Sebelum dipublikasikan

1. **`NEXT_PUBLIC_WHATSAPP_NUMBER`**. Selama kosong, semua CTA jatuh ke
   daftar guru dengan label "Lihat guru privat".
2. **Foto sesi sungguhan** (4:3) di kartu "Satu guru, satu murid", dengan izin
   tertulis keluarga bila wajah anak terlihat. Slotnya tampil sebagai bingkai
   bertanda.
3. **Tarif.** FAQ mengarahkan ke WhatsApp; bila tarif mau dipublikasikan,
   tambahkan di jawaban "Berapa biayanya?".
4. **Judul hero tanpa kata kunci.** "Setiap huruf punya tempatnya." tidak
   memuat "tahsin". Kata kunci ada di subjudul, `<title>`, dan meta
   description; ini pertukaran yang disadari antara SEO dan kesan pertama.

---

## Pembaruan 2026-09-29: kaligrafi latar dan hero bergerak

### Kaligrafi latar (`src/components/landing/kaligrafi.tsx`)

Kata Arab besar dan transparan di sudut tiap bagian, font **Aref Ruqaa** (khat
riq'ah). Dipilih dari 8 kandidat setelah dirender berdampingan: Qahiri
(kufi Fatimiyah) terlalu sulit dibaca orang awam, Blaka Hollow membuat ف
tampak seperti ه.

| Bagian | Kata | Arti |
|---|---|---|
| Hero | تنافس | saling berlomba (nama Tanafus) |
| Masalah | قراءة | bacaan |
| Yang Anda dapatkan | تقدّم | kemajuan |
| Guru | معلّم | guru |
| Cara mengajar | مشافهة | musyafahah |
| Mulai | بداية | permulaan |
| Tanya jawab | سؤال | pertanyaan |
| Penutup | ابدأ | mulailah |

**Aturan:** kaligrafi latar hanya memakai kata biasa. **Tidak pernah ayat
Al-Qur'an atau lafaz Allah**, karena teks suci yang dijadikan latar tipis dan terus
tertimpa guliran tidak pantas. Ayat tetap tampil sebagai isi, dengan terjemahan
dan rujukan, di bagian "Kenapa namanya Tanafus?" (yang karena itu sengaja tidak
diberi kaligrafi latar).

### Judul hero

Tiga baris ditulis manual, bukan SplitText, sehingga letak patahnya pasti.
"**benar.**" merah, miring, 1,24× lebih besar, lalu dilingkari coretan merah yang
tergambar sendiri (satu path SVG, `pathLength=1`), seperti guru melingkari
bacaan yang dikoreksi.

### Loop huruf hero

Enam huruf yang paling sering dikoreksi dalam tahsin (ض ح ع ق ص ظ) bergantian,
3,4 detik per huruf, tanpa sambungan terlihat. Setiap huruf melalui empat fase:

1. Gelombang "melafalkan" huruf.
2. Gelombang diam, titik merah terangkat.
3. Huruf berganti.
4. Titik mendarat, disusul letupan bunyi.

Loop dijeda saat hero tidak terlihat.

> ⚠️ **Titik merah tidak boleh duduk tepat di atas huruf.** Titik di atas huruf
> adalah *i'jam*, yang mengubah identitas huruf: **ح bertitik terbaca خ, ع
> bertitik terbaca غ.** Ini sempat terjadi di versi pertama loop dan terlihat di
> tangkapan layar. Titik kini ditaruh di **luar sudut kanan atas tinta**, posisi
> yang tidak pernah ditempati i'jam. Posisinya **diukur** dari batas tinta glif
> dengan `canvas.measureText`, bukan ditebak dalam persen, karena tinggi tinta
> ض, ح, dan ظ sangat berbeda.

**Terverifikasi di Chrome headless:** keenam huruf muncul berurutan, posisi titik
di akhir putaran identik dengan awalnya (loop mulus), dan tidak ada error konsol.

---

## Pembaruan 2026-09-29 (2): penekanan titik, halaman Tentang, kaligrafi bersambung

### Penekanan kata (`Tekanan` di `src/components/landing/kerangka.tsx`)

Lingkaran coretan dihapus, dan ukuran kata tidak lagi dibesarkan. Penekanan kini
memakai **tema titik**. Kata mula-mula berwarna seperti teks sekitarnya, lalu titik
merah jatuh memantul ke luar sudut kanan atas kata (posisi yang sama dengan titik di
huruf hero). Saat titik menyentuh, kata berubah merah dan cincin riak menyebar.
Titik ditaruh sedikit di atas tinggi huruf kapital agar kata di tengah kalimat
("Guru Tanafus") tidak menempel ke kata berikutnya.

Dipakai di judul hero dan **setiap judul bagian**. Titik pada "benar." di hero
berdenyut dan beriak setiap kali titik huruf di loop mendarat.

**Jangan pasang Tekanan di dalam `data-lines`:** mask SplitText memotong titiknya.

### Halaman `/tentang`

Bagian "Kenapa namanya Tanafus?" dipindah dari beranda ke halaman sendiri, dan di
beranda diganti ringkasan motto yang menaut ke `/tentang`. Isinya:

- Arti nama: ayat 26, *nafīs*, "berlomba menuju, bukan melawan", dan ayat 1.
- **Kisah titik merah Abu al-Aswad ad-Du'ali**, dengan ilustrasi titik yang jatuh
  ke huruf.
- Motto dan rujukan.

Fakta yang diverifikasi:

| Fakta | Sumber |
|---|---|
| Abu al-Aswad wafat 69 H / 688 M | Wikipedia |
| Posisi titik: atas = fathah, bawah = kasrah, di depan huruf = dhammah | islamiccenter.org, Wikipedia |
| Riwayat salah baca QS. At-Taubah: 3 | islamiccenter.org, tafsiralquran.id |
| al-Khalil bin Ahmad al-Farahidi (w. 786 M) mengganti titik dengan tanda harakat | Wikipedia |

**Makna "dua titik" sengaja tidak ditulis:** sumber berbeda, ada yang menyebut
tanwin dan ada yang menyebut sukun.

Ilustrasinya memakai **مـــ** (mim di awal kata), dengan dua alasan:

1. Titik di posisi mana pun tidak mengubah mim menjadi huruf lain. Pada huruf lain
   bisa: titik di atas د terbaca ذ, di bawah ح terbaca ج.
2. Ekor م tunggal turun 0,52 em dan menabrak keterangan di bawahnya.

Posisi titik diukur dengan `canvas.measureText` dan ditulis dalam satuan em.

### Kaligrafi bersambung

`overflow-clip` dilepas dari semua bagian. Kaligrafi menjulur sekitar 0,42 em ke
bagian berikutnya, berselang kiri dan kanan, sehingga halaman terasa bersambung.
Bagian berikutnya digambar setelahnya, jadi isinya tetap di atas kaligrafi.
Terverifikasi: tinggi dokumen tetap sama dengan dasar footer (tidak ada ruang
gulir kosong), dan tidak ada scroll horizontal.

---

## Pembaruan 2026-09-29 (3): penyempurnaan titik, dark mode, gelombang berwarna

- **Titik penekanan** kini duduk di atas ujung kanan katanya sendiri
  (`-right-[0.1em] top-[0.03em]`). Hasil ukur: spasi di judul hanya ~0,14 em
  (tracking rapat), lebih sempit dari titik 0,18 em. Posisi lama menjorok ke celah
  spasi dan menabrak kata berikutnya sebanyak 4px ("Guru Tanafus", "tiga
  langkah"); sekarang ada jarak +3px di desktop dan +2px di ponsel.
- **Animasi penekanan diperlambat:** titik jatuh 1,15 detik (sebelumnya 0,8), riak
  1,5 detik, dan transisi warna kata 0,9 detik.
- **Dark mode:** garis pembatas antarbagian dihilangkan lewat token terpisah
  `--ld-pembatas` (transparan di mode gelap). `--ld-line` untuk bingkai kartu dan
  pemisah FAQ tetap ada. Latar `html`/`body` kini mengikuti halaman
  (`html:has(.ld)`), sehingga overscroll di ponsel tidak lagi memunculkan pita
  putih.
- **Gelombang berwarna:** saat titik huruf mendarat, 14 batang tengah gelombang
  memerah selama 0,85 detik, menekankan pelafalan huruf yang baru muncul.

**Dua bug yang ditemukan saat verifikasi:**

1. Efek sinkron di dalam loop (riak judul) memperpanjang timeline melewati
   6 x 3,4 detik, sehingga sambungan loop tersendat. Solusinya: semua efek sinkron
   dijalankan lewat `loop.call()` yang berdurasi nol. Terverifikasi: posisi titik
   di putaran kedua identik dengan putaran pertama.
2. Membungkus efek sinkron dengan `contextSafe` membuat konteks GSAP saling
   merujuk. Saat preferensi "kurangi gerak" berubah di tengah jalan, muncul
   *Maximum call stack size exceeded*. Pembungkus itu sudah dihapus.
   Terverifikasi: preferensi diubah bolak-balik saat loop berjalan, tanpa satu pun
   exception.

---

## Pembaruan 2026-09-29 (4): sepuluh huruf, label makhraj dan sifat, loop mulus

### Sepuluh huruf, dengan makhraj dan sifatnya

Loop kini memuat 10 huruf, dipilih agar semua wilayah makhraj terwakili
(tenggorokan, pangkal/tengah/tepi/ujung lidah, bibir) dan tiap huruf punya ciri
yang menarik. Saat huruf tampil, 2 sampai 3 label muncul satu per satu di
sekitarnya: label pertama makhraj, sisanya sifat. (Sejak pembaruan 5, label hanya
berisi nama Arab dan Latin, tanpa keterangan; kolom keterangan di tabel ini
tinggal sebagai catatan.)

| Huruf | Makhraj | Sifat yang ditampilkan |
|---|---|---|
| ض | حافة اللسان, tepi lidah | استطالة Istithalah (**khas ض**), إطباق Ithbaq |
| ح | وسط الحلق, tengah tenggorokan | همس Hams |
| ع | وسط الحلق, tengah tenggorokan | توسط Tawassuth |
| ق | أقصى اللسان, pangkal lidah | قلقلة Qalqalah, استعلاء Isti'la |
| ش | وسط اللسان, tengah lidah | تفشي Tafasysyi (**khas ش**) |
| ر | طرف اللسان, ujung lidah | تكرير Takrir (**khas ر**) |
| ص | طرف اللسان, ujung lidah | صفير Shafir |
| ظ | طرف اللسان, ujung lidah | إطباق Ithbaq |
| ط | طرف اللسان, ujung lidah | قلقلة Qalqalah, إطباق Ithbaq |
| م | الشفتان, dua bibir | غنة Ghunnah |

Label "khas" hanya dipasang pada sifat yang memang dimiliki satu huruf saja.
Sumber: tajwid.web.id, almustari, mediaindonesia, detik, arabi.id.

> **Minta guru memeriksa tabel ini sebelum rilis.** Istilah makhraj
> diringkas (mis. طرف اللسان untuk kelompok ujung lidah); rinciannya berbeda antar
> kitab. Data ada di `HURUF` pada `src/app/page.tsx`.

**Letak label dihitung dari piksel tinta, bukan kotak batas.** Kotak batas saja
tidak cukup: sudut kanan atas kotak ض kosong, tetapi kepala ض justru ada di sisi
kanan, dan versi pertama menutupinya. Kini glif digambar ke kanvas tersembunyi.
Dari semua posisi di dalam kolom hero dipilih posisi yang paling sedikit menutupi
tinta, lalu yang terdekat dengan tempat pilihannya (kiri atas, kanan, kiri bawah).
Titik merah dan label lain menjadi penghalang, dan label tidak turun ke
gelombang.

Terverifikasi untuk 10 huruf di lebar 1280, 1024, dan 390: 29 dari 30 kasus
menutupi **0 piksel tinta**. Satu-satunya pengecualian adalah ض di lebar 1024 (3%
tinta, menyentuh tepi mangkuknya). Tidak ada label yang keluar kolom, tidak ada
scroll horizontal, dan tidak ada tabrakan dengan titik atau label lain.

Dengan "kurangi gerak", label ض tampil diam di tempatnya. Tanpa JS, label tidak
ditampilkan.

### Gelombang merah menyebar dari tengah

Merah tidak lagi hanya menyala di 14 batang tengah. Kini merah **menjalar dari
tengah ke seluruh gelombang** (jeda transisi 16 ms per batang dari tengah,
variabel `--jarak`), bertahan 1,1 detik, lalu surut dengan urutan yang sama
sehingga terlihat seperti gelombang bunyi yang merambat keluar.

### Bug: loop tersendat lama di sambungan

Gejalanya: di akhir putaran, huruf pertama (ض) diam sekitar 5,5 detik, sedangkan
huruf lain hanya 3,2 detik.

Penyebabnya: fase bicara memakai satu tween dengan `repeat: 9, yoyo: true` dan
`stagger`. Di GSAP, `repeat` mengulang **seluruh urutan stagger** (0,576 dtk x 10 =
5,76 dtk), bukan 0,2 detik per batang. Akibatnya fase bicara jauh melampaui
`BICARA`, dan tween terakhir memperpanjang timeline.

Solusinya: fase bicara kini 10 langkah terpisah ("suku kata" tinggi dan rendah
bergantian), masing-masing tepat `BICARA / 10`. `BICARA` = 3,2 detik dan
`SIKLUS` = 4,25 detik, jadi satu putaran penuh 42,5 detik.

Verifikasi sebelumnya (pembaruan 3) hanya membandingkan posisi titik di satu
titik waktu, sehingga tidak menangkap bug ini. Kini dipakai **pencatat keadaan
setiap 150 ms selama 95 detik** (dua putaran penuh). Hasilnya, semua huruf tampil
4,0 sampai 4,2 detik, termasuk ض di putaran kedua dan ketiga. Gelombang tidak
pernah diam lebih dari 0,9 detik, kecuali selama intro. Tidak ada error konsol.

---

## Pembaruan 2026-09-29 (5): label minimal, gulir halus, mikrointeraksi

- **Garis antarbagian dihapus di kedua tema.** Token `--ld-pembatas` ikut
  dihapus.
- **Label huruf** kini berupa kartu merah brand (`bg-ld-red`, teks `ld-on-red`,
  `rounded-2xl`), hanya berisi nama Arab di atas dan nama Latin di bawahnya. Kartu
  vertikal ini lebih sempit dari pil horizontal versi sebelumnya, sehingga
  ketiga puluh kasus (10 huruf x 3 lebar layar) kini menutupi 0 piksel tinta. Di mode gelap teksnya gelap di atas merah
  terang, sehingga kontras tetap terjaga. Pil muncul dari skala 0,7 dengan
  pantulan. Letaknya tetap dihitung dari piksel tinta.
- **Gulir halus dengan Lenis** (`lenis` 1.3). Dipilih Lenis, bukan ScrollSmoother
  GSAP, karena Lenis tetap memakai gulir asli browser: `position: sticky` pada
  tumpukan kartu langkah tetap bekerja. Lenis digerakkan ticker GSAP dan setiap
  gulirnya memanggil `ScrollTrigger.update`, sehingga keduanya membaca posisi pada
  frame yang sama. Tautan jangkar (`#guru`) ikut digulir halus. Ruang navigasi
  berasal dari `scroll-mt-24`, yang dihormati Lenis; menambah `offset` membuat
  jaraknya dobel (terukur mendarat di 184 px, seharusnya 96 px). Lenis tidak
  dipasang saat gerak dikurangi.
- **Mikrointeraksi:**

| Elemen | Interaksi |
|---|---|
| Tanya jawab | Jawaban tumbuh dari tinggi 0 dan teksnya naik memudar. Menutup: tinggi menyusut dulu, baru `<details>` ditutup. Ikon + berputar menjadi × dan terisi merah; pertanyaan memerah saat disorot. Tetap `<details>` asli: tanpa JS atau saat gerak dikurangi, perilaku bawaan browser tetap bekerja. |
| Navigasi | Transparan tanpa garis di puncak halaman; latar kabur dan garis muncul setelah digulir 8 px. |
| Tautan teks | Garis merah menyapu dari kiri di atas garis abu-abu saat disorot atau difokus (`.ld-tautan`). |
| Tombol utama | Panah bergeser ke arah tujuannya (serong untuk WhatsApp, yang membuka tab baru). |
| Logo | Titik merah melompat kecil saat disorot. |
| Syarat guru | Lingkaran centang muncul memantul saat masuk layar. |

Kartu bento sengaja **tidak** diberi efek sorot, karena kartu itu bukan tautan
dan efek sorot akan menjanjikan klik yang tidak ada.

**Terverifikasi di Chrome headless:**
- tebal garis atas semua bagian 0 px;
- navigasi transparan di puncak dan berlatar setelah digulir;
- satu putaran roda menggulir melandai dan berhenti perlahan;
- tautan `#guru` mendarat 96 px dari atas;
- FAQ membuka dengan tinggi 0 → 91 px dan menutup 91 → 0 px sebelum `open` dilepas;
- dengan gerak dikurangi, FAQ asli tetap membuka dan Lenis tidak aktif;
- tidak ada error konsol.

---

## Pembaruan 2026-09-29 (6): animasi per bagian

Semua diputar sekali, tidak pernah berulang. Semua mati saat gerak dikurangi, dan
tidak ada konten yang tersembunyi tanpa JS: server selalu merender keadaan
akhirnya.

| Bagian | Animasi | Catatan teknis |
|---|---|---|
| 2. Masalah | Kata demi kata menebal dari abu-abu ke hitam saat digulir, seperti mengikuti bacaan. | `data-baca`. SplitText `lines,words` dengan scrub. Yang dianimasikan opacity, bukan warna, karena `var(--ld-*)` tidak bisa di-tween. |
| 3. Laporan | Empat nilai menghitung naik dari 0. | `data-hitung`, `tabular-nums` agar lebar angka tidak goyang. |
| 3. "0 sesi hangus" | Hitung mundur 9 → 0, lalu titik jatuh memantul di atas angka 0. | `data-hitung-mundur`, `data-titik-nol`. Angka 9 hanya gerak, tidak ada klaim di baliknya. |
| 5. Cara mengajar | تَلَقِّي "dituliskan" dari kanan ke kiri (arah tulisan Arab), tersambung ke gulir. Di belakangnya ada bayangan pudar kata yang sama. | `data-tulis`, `clip-path: inset()`. Di desktop tulisan mengikuti pembacaan tiga poin di kanan, di ponsel mengikuti kata itu sendiri. Terverifikasi selesai saat kata masih menempel di layar. |
| 6. Langkah 1 | Tanda "sedang mengetik" (tiga titik memantul), lalu pesan WhatsApp muncul kata demi kata. | `data-pesan`. |
| 6. Langkah 3 | Catatan guru tertulis kata demi kata. | `data-catatan`. |
| 7. Motto | Titik penekanan berlari memantul di atas kata-kata dari awal baris menuju "terbaik." (tanafus = berlomba). | `data-balap`. Awal baris diukur dengan Range, karena judul pecah berbeda di tiap layar. Jumlah setengah-lompatan genap, jadi titik mendarat tepat di y 0. |
| 9. Penutup | Kaligrafi ابدأ tumbuh pelan; tombol memancarkan dua cincin riak sekali. | Cincin digeser lewat top/right/bottom/left, bukan scale, agar tebal garisnya tetap 2 px. Memakai `immediateRender: false` agar cincin tidak tampil sebelum riak dimulai. |

Garis kemajuan gulir di bawah navigasi sengaja tidak dibuat (keputusan pemilik).

**Bug navigasi yang ditemukan:** dengan `end: "max"`, `isActive` padam tepat di dasar
halaman, sehingga navigasi kembali transparan di atas blok merah penutup dan titik
logo hilang. Kini status navigasi dibaca dari posisi gulir (`scroll() > 8`).

**Catatan uji:** panel browser di aplikasi menjeda `requestAnimationFrame` saat
tersembunyi, sehingga ScrollTrigger tidak pernah terpicu di sana. Semua animasi
diuji di Chrome headless. Hasilnya:
- nilai 42 → 78, 71, 84, 80;
- hitung mundur 3 → 1 → 0, lalu titik muncul;
- klip تَلَقِّي 110% → 29% → penuh;
- tiga titik mengetik tampil ~1,2 dtk, lalu 13 kata;
- titik balap x −538 → 0 dengan lompatan;
- cincin riak −9 → −22 px sambil memudar.

Tidak ada scroll horizontal dan tidak ada error konsol, baik di beranda maupun di
`/tentang`.

---

## Pembaruan 2026-09-30 (7): warna kartu label, CTA WhatsApp tambahan

### Kartu label huruf

Warna kartu kini diatur lewat token `--ld-kartu-*` di `globals.css`.

| | Latar | Garis | Teks Arab | Teks Latin |
|---|---|---|---|---|
| Terang | putih #FFFFFF | merah #C8261B | merah #C8261B (5,6:1) | abu gelap #6E6E68 (5,1:1) |
| Gelap | merah tua #C8261B | sama | putih (5,6:1) | putih pudar #F9E4E1 (4,6:1) |

Alasan pilihannya:
- **Teks Arab di mode terang merah, bukan hitam.** Kalau hitam, kartu bersaing
  dengan huruf hijaiyah besar yang juga hitam. Merah membuatnya terbaca sebagai
  keterangan dan senada dengan titik.
- **Latar kartu di mode gelap memakai merah yang lebih tua.** Teks putih di atas
  merah terang mode gelap (#FF5A4A) hanya 3,1:1 dan gagal untuk teks kecil. Merah
  #C8261B tetap kontras 3,35:1 terhadap latar gelap.

Setelah perubahan ini semua kasus uji tetap menutupi 0 piksel tinta (10 huruf,
lebar 1280 dan 390).

### CTA WhatsApp

| Lokasi (`data-analytics-lokasi`) | Alasan |
|---|---|
| `navigasi`, `hero`, `penutup` | Sudah ada sebelumnya. |
| `masalah` | Tepat setelah taruhan dinyatakan ("Makin lama dibiarkan…"), saat rasa perlu paling kuat. |
| `guru` | Setelah kepercayaan pada guru terbangun, di samping tautan kualifikasi. |
| `langkah-1` | Langkah pertama memang "Chat kami di WhatsApp", jadi tombolnya ditaruh di kartu itu. |
| `tanya-jawab` | "Pertanyaan Anda belum terjawab?" di akhir FAQ. |
| `mengambang` | Tombol di pojok kanan bawah; di ponsel hanya ikon. Muncul setelah hero terlewati dan bersembunyi saat blok penutup terlihat (di sana sudah ada tombol). Saat tersembunyi juga tidak bisa difokus dengan Tab. |

Semua tombol memakai label yang sama ("Chat via WhatsApp") dan warna merah brand,
bukan hijau WhatsApp, agar warna aksen tetap satu. Atribut `data-analytics-lokasi`
memungkinkan membandingkan tombol mana yang paling sering ditekan.

> ⚠️ **Nomor WhatsApp masih sementara:** `NEXT_PUBLIC_WHATSAPP_NUMBER=6280000000000`
> di `.env.local` (tidak ikut commit). Nomor ini sengaja tidak ada, supaya pesan
> uji tidak sampai ke orang asing. Ganti dengan nomor admin asli di `.env.local`
> dan di pengaturan environment Vercel sebelum rilis, lalu restart server dev.

---

## Pembaruan 2026-09-30 (8): form /onboarding sebagai ajakan utama

Ajakan utama pengunjung baru kini "Cari guru yang cocok" → `/onboarding`: form
singkat, satu pertanyaan per layar, yang berakhir di WhatsApp dengan jawaban
sudah tersusun menjadi pesan. WhatsApp tetap menjadi saluran percakapan, dan
admin langsung menerima data yang dibutuhkan untuk mencocokkan guru.

### Pertanyaan

| # | Pertanyaan | Pilihan | Hiasan kartu |
|---|---|---|---|
| 1 | Siapa yang akan belajar? | Anak saya / Saya sendiri | طِفْل (anak), أَنَا (saya) |
| 2 | Berapa usia anak Anda? *(dilewati bila "Saya sendiri")* | <7, 7–9, 10–12, 13+ | 1 sampai 4 titik, makin besar seiring usia |
| 3 | Sampai mana bacaannya sekarang? | Belum kenal huruf / per jilid / belum lancar / ingin tajwid | أ ب ت, هِجَاء, تِلَاوَة, تَجْوِيد |
| 4 | Ingin belajar dengan siapa? | Ustadz / Ustadzah / Siapa saja | أُسْتَاذ, أُسْتَاذَة, سَوَاء |
| 5 | Kapan waktu yang cocok? *(boleh lebih dari satu)* | Pagi, Siang, Sore, Malam | صَبَاح, ظُهْر, عَصْر, مَسَاء |
| 6 | Siapa nama Anda? | teks | — |
| 7 | Ringkasan pesan, lalu "Kirim lewat WhatsApp" | | |

Nomor WhatsApp tidak ditanyakan: saat pengunjung mengirim pesan, admin sudah
melihat nomornya. Hiasan mengikuti aturan kaligrafi (tidak pernah ayat, tidak
pernah lafaz Allah).

### Keputusan yang diambil (bisa diubah owner)

- **Jawaban tidak disimpan.** Jawaban hanya disusun menjadi pesan WhatsApp yang
  dikirim sendiri oleh pengunjung, dan halaman ringkasan menyatakannya. Menyimpan
  ke basis data berarti menyimpan data anak: wajib ada persetujuan dan data
  minimal (UU PDP).
- **Tidak ada janji waktu balas** dan **tidak ada harga atau uji coba gratis**,
  karena keduanya belum diputuskan.
- `robots: noindex`: ini halaman alur, bukan konten.

### Gerak dan interaksi

- **Pindah pertanyaan:** isi lama keluar, lalu judul dan kartu baru masuk
  bergiliran dari arah maju/mundur.
- **Hiasan kartu:** bergeser pelan dari kanan (arah tulisan Arab). Kartu yang
  terpilih memantul kecil, hiasannya memerah, dan titik merah muncul di pojok.
  Pada pertanyaan yang boleh lebih dari satu jawaban, titiknya berisi centang.
- **Titik kemajuan:** titik yang selesai berwarna tinta, yang sedang aktif
  berupa pil merah.
- **Ringkasan:** tanda "sedang mengetik", lalu pesan muncul kata demi kata.
- **Keyboard:** kartu adalah radio/checkbox asli di dalam fieldset. Klik
  mouse/sentuh langsung maju. Dengan keyboard, panah hanya mengganti pilihan,
  lalu Enter atau "Lanjut" untuk maju. Browser tidak mengirim form saat Enter
  ditekan di radio, jadi Enter ditangani sendiri. Fokus pindah ke judul
  pertanyaan baru. Pindah otomatis yang masih menunggu dibatalkan bila tombol
  lain ditekan, supaya klik ganda tidak melompati pertanyaan.

### Bug yang ditemukan saat verifikasi

`from()` pada hiasan membaca opacity saat itu sebagai nilai akhir. Di
development, React memasang efek dua kali, sehingga yang terbaca adalah nilai
setengah jalan: hiasan berakhir di opacity ~0,0001 (tak terlihat). Sekarang
elemen dalam dianimasikan ke opacity 1 yang eksplisit, dan kepudarannya ada di
elemen luar lewat kelas CSS.

### Perubahan di halaman depan

| Lokasi | Sekarang |
|---|---|
| navigasi, hero, masalah, guru, langkah 1, penutup, penutup `/tentang` | `TombolMulai` → `/onboarding` |
| hero, penutup | tambahan tautan sekunder "atau tanya dulu via WhatsApp" |
| akhir FAQ, tombol mengambang | tetap WhatsApp (untuk bertanya langsung) |

Langkah 1 kini berbunyi "Jawab beberapa pertanyaan singkat". Contoh pesannya
dibuat oleh fungsi yang sama dengan form (`susunBaris`), sehingga selalu sesuai.

Semua tombol diberi `data-analytics="cta-onboarding"` atau `"cta-whatsapp"`
beserta lokasinya, supaya jumlah form yang selesai bisa dibandingkan dengan chat
langsung.

### File baru

- `src/app/onboarding/page.tsx`
- `src/components/onboarding/form-onboarding.tsx`
- `src/components/onboarding/pertanyaan.ts`: data pertanyaan dan penyusun pesan
- `src/components/landing/gaya.ts` dan `whatsapp.ts`: modul murni, dipakai
  bersama komponen server dan client

### Terverifikasi di Chrome headless

Diuji di 1280 terang dan 390 gelap:
- jalur anak (7 layar) dan dewasa (6 layar, usia dilewati);
- pilihan jamak tidak pindah otomatis;
- tombol "Lanjut" nonaktif sampai nama diisi;
- isi pesan WhatsApp tepat;
- "Ubah jawaban" kembali ke awal dengan jawaban tetap tercentang;
- navigasi keyboard;
- gerak dikurangi.

Tidak ada scroll horizontal dan tidak ada error konsol.

---

## Pembaruan 2026-09-30 (9): /tentang dirombak, titik pemandu

Halaman `/tentang` kini satu cerita yang dipandu **satu titik merah**. Titik itu
menemani pembaca dari bagian ke bagian dan mendarat di hal penting tiap bagian.

### Keputusan owner

- **Gambar:** foto mushaf asli dari The Met (Open Access, domain publik, boleh
  komersial), ditambah ilustrasi dari huruf dan titik.
- **Titik:** 2D datar seperti logo, bukan bola 3D. three.js terlalu berat untuk
  ponsel dan bentuknya berbeda dari titik brand.
- **Demonstrasi titik hanya pada huruf mim.** Kata dari ayat (رَسُولُهُ) tidak
  dipakai; kisah salah baca At-Taubah: 3 tetap berupa teks.

### Alur dan halte titik

| # | Bagian | Titik |
|---|---|---|
| 1 | Pembuka "Semua berawal dari satu titik merah." | Lingkaran besar, mengecil saat digulir |
| 2 | Satu tulisan, banyak bacaan (علم tanpa harakat, lalu 4 bacaan dengan harakat merah) | Melayang jauh di atas kata, "mencari tempatnya" |
| 3 | Titik Abu al-Aswad, adegan menempel (mim) | Berpindah ke atas (fathah), bawah (kasrah), depan (dhammah) mengikuti tiga langkah |
| 4 | Mushaf asli (foto The Met 37.30 dan 62.152.2) | Mendarat di salah satu titik merah asli di foto |
| 5 | al-Khalil: dari titik menjadi garis | Memipih menjadi garis fathah |
| 6 | Nama Tanafus, QS. Al-Muthaffifin: 26 | Memanjang menjadi garis bawah kata *falyatanāfas* |
| 6b | Tiga nilai | Melompat dari nilai ke nilai, seperti berlomba |
| 7 | Ajakan | Membesar menjadi blok merah penutup, lalu melebur |

### Cara kerja (`src/components/tentang/titik-pemandu.tsx`)

- Tiap halte adalah elemen `data-halte`. Kotaknya menentukan posisi **dan**
  ukuran titik: lingkaran, titik, garis, atau blok.
- Satu elemen `position: fixed`. Posisi titik dan rentang gulir tiap ruas
  dihitung ulang **setiap frame** dari `getBoundingClientRect`. Karena itu
  titik tetap menempel pada adegan sticky, pada blok yang sedang dianimasikan
  masuk, dan pada tata letak yang bergeser.
- Lintasan antarhalte melengkung (titik "melompat"). Menuju blok penutup,
  ukuran baru membesar di ujung perjalanan, supaya tidak menutupi isi.
- **Tanpa JS atau saat gerak dikurangi:** halte bergambar tampil diam sebagai
  ilustrasi (lingkaran, tiga titik mim, garis fathah, garis bawah, titik
  nilai). Saat titik aktif, halte disembunyikan lewat
  `html[data-pemandu-aktif]`.

### Bug yang ditemukan saat verifikasi

1. **Rentang dari hitungan sekali bergeser 48 px.** Awalnya rentang ruas
   memakai ScrollTrigger yang dihitung saat halaman dimuat, ketika blok
   `data-reveal` masih tergeser. Akibatnya titik tertahan di tengah jalan.
   Sekarang rentang dihitung dari geometri langsung setiap frame.
2. **Ruas terbalik di desktop** (tiba sebelum berangkat), antara garis bawah
   ayat dan nilai pertama, karena ketiga nilai sejajar. Posisi tiba/berangkat
   sudah disetel ulang. Di development, ruas terbalik kini memunculkan
   peringatan konsol.
3. **Titik di atas ع terbaca غ (i'jam).** Titik yang melayang di atas علم
   awalnya tepat di atas ع. Sekarang titik berada 0,3 em di atas kata, di atas
   lam, jauh dari huruf mana pun.
4. **Titik di foto lonjong (14×18 px).** Tinggi persen mengacu ke tinggi
   gambar; kini memakai lebar dan `aspect-square`.
5. **عَلَّمَ diganti عَلِمَ.** Tasydid mengubah bentuk sambungan huruf, sehingga
   lapisan merah `HarakatMerah` menyembul.

### Verifikasi (Chrome headless, 1280 terang dan 390 gelap)

- Titik tepat di **12 dari 12 halte** di kedua lebar, dengan selisih pusat
  0 px dan ukuran sama.
- Tidak ada scroll horizontal.
- Saat gerak dikurangi, titik tidak aktif dan ilustrasi statis tampil.
- Tidak ada error konsol. Peringatan LCP gambar hanya muncul di development,
  karena skrip uji menggulir halaman.

### File

- **Baru:**
  - `src/components/tentang/titik-pemandu.tsx`
  - `src/components/tentang/harakat-merah.tsx`
  - `public/tentang/mushaf-met-37-30.jpg` (1356×1776, 0,5 MB)
  - `public/tentang/mushaf-met-62-152-2.jpg` (2646×1402, 0,95 MB)

  Keduanya disajikan lewat `next/image` (WebP/AVIF sesuai ukuran layar).
- **Dirombak:** `src/app/tentang/page.tsx`. Rujukan kini menyertakan The Met.

Sumber foto:
- [37.30](https://www.metmuseum.org/art/collection/search/449111)
- [62.152.2](https://www.metmuseum.org/art/collection/search/451677)

---

## Pembaruan 2026-09-30 (10): penekanan judul, bentuk berubah saat tiba, kartu nilai, CTA

- **Penekanan di semua judul `/tentang`** (h1 dan setiap h2), dengan titik
  penekanannya sendiri seperti di beranda. Titik ini terpisah dari titik
  pemandu. Judul hero ikut intro, judul lainnya terpicu saat digulir.
- **Titik berubah bentuk hanya setelah tiba.** Di jalan titik selalu titik
  biasa (19 px di desktop, 12 px di ponsel), posisinya tersambung ke gulir.
  Setelah tiba, titik berubah menjadi bentuk halte dengan pantulan
  `elastic.out(1, 0.45)` selama 0,9 detik: lingkaran membesar, garis fathah
  memanjang lalu kembali, garis bawah memanjang lalu kembali. Saat berangkat,
  titik mengambil ancang-ancang (`back.in`), lalu kembali menjadi titik biasa.
  Perubahan bentuk berbasis waktu, bukan gulir, supaya pantulannya selalu
  terasa.
- **Jendela istirahat diperlebar** menjadi 22% layar (tiba "center 60%",
  berangkat "center 38%"), supaya pantulan terlihat utuh walau pengguna terus
  menggulir.
- **Kartu nilai:**
  - Di desktop ketiga kartu menempel (sticky) di dalam panggung setinggi
    260vh, jadi tiap lompatan menempuh setengah layar gulir. Sebelumnya hanya
    8% layar dan terasa terlalu cepat.
  - Nilai kini berbentuk kartu. Kartu yang sedang disinggahi garisnya memerah:
    `[data-sorot]` mendapat `data-disinggahi`.
- **CTA:**
  - Blok penutup mulai agak transparan (opacity 0,6).
  - Titik tiba sebagai titik biasa di tepi atas blok, memantul sekali, lalu
    tenggelam ke dalamnya, dan blok menjadi penuh (opacity 1).
  - Saat digulir kembali ke atas, titik muncul lagi dan blok kembali agak
    transparan.
  - Tanpa JS atau saat gerak dikurangi, blok langsung penuh.

**Terverifikasi di Chrome headless (1280 terang, 390 gelap):**
- 11 halte tepat (selisih 0 px), dan pada halte CTA titik tenggelam hingga
  0×0.
- Di semua 11 ruas, titik di jalan berupa titik biasa.
- Ketiga kartu nilai memerah saat disinggahi.
- Opacity blok 0,6 sebelum titik tiba, lalu 1.
- Semua titik penekanan judul terpicu.
- Rekaman per frame menunjukkan pantulan fathah, garis bawah, dan tenggelam
  di CTA.
- Tidak ada ruas terbalik, tidak ada scroll horizontal, dan tidak ada error
  konsol.

---

## Pembaruan 2026-09-30 (11): brand v2 untuk seluruh aplikasi + tombol tema

Desain halaman depan kini menjadi brand **seluruh aplikasi**: auth, dashboard
(admin, guru, orang tua), halaman publik, dan halaman 403. Brand v1
(plum/oranye, `docs/11-brand-guidelines.md`) tidak lagi dipakai di UI.

### Token (`src/app/globals.css`)

- **Satu sumber warna**, token `--tf-*`: kertas, permukaan, tinta, redup,
  garis, dan satu merah. Nilai terang dan gelap sama dengan halaman depan,
  dan pasangan teks utamanya sudah diukur WCAG AA.
- **Token shadcn** (`--background`, `--primary`, `--card`, dst.) memakai
  `--tf-*`, jadi semua komponen `ui/` ikut.
- **Nama kelas lama dipertahankan sebagai alias:**
  - `plum-*` menjadi skala tinta (dibalik di mode gelap, jadi `text-plum-800`
    tetap paling kontras);
  - `orange-*` menjadi merah titik;
  - `cream-*` menjadi kertas.

  Sekitar 560 pemakaian di dashboard ikut berganti tanpa menyunting 100 file.
- **Token `--ld-*`** kini juga berlaku di root, supaya `tombolUtama` dan
  `tautan` (`gaya.ts`) benar di luar halaman depan.
- **Teks di atas merah:** di mode gelap memakai teks gelap
  (`--primary-foreground`), bukan putih. Putih di atas merah terang hanya
  3,1:1.

### Tema terang/gelap

| Bagian | Isi |
|---|---|
| `src/lib/tema.ts` | Skrip `<head>` yang memasang kelas `.dark` sebelum halaman digambar, jadi tidak ada kedipan terang. Pilihan disimpan di `localStorage["tema"]`; bila belum memilih, tema mengikuti sistem. |
| `SinkronTema` (di `Providers`) | Memasang ulang kelas setelah remount Strict Mode di development, mengikuti perubahan tema sistem selama pengguna belum memilih, dan menyinkronkan antartab. |
| `TombolTema` | Ikon matahari/bulan bertukar lewat varian `dark:` (CSS). Tema baru muncul sebagai lingkaran yang membesar dari tombol (View Transitions API), seperti titik merah. Mati saat gerak dikurangi. |
| Letak tombol | Navigasi beranda dan /tentang, header /onboarding, header auth dan halaman publik, sidebar dashboard (desktop), dan topbar ponsel. |

CSP sudah mengizinkan skrip inline (`script-src 'unsafe-inline'`).

### Komponen dan mikrointeraksi

- **Font:** Plus Jakarta Sans untuk seluruh aplikasi (menggantikan Noto Sans
  dan Playfair), Amiri untuk teks Arab (menggantikan Noto Naskh).
- **`ui/`:**
  - Tombol berbentuk pil dengan huruf biasa: terangkat sedikit saat disorot,
    tertekan (scale 0,97) saat diklik.
  - Kartu dan dialog bersudut 3xl dengan garis tipis.
  - Menu dan select membulat.
  - Label, tab, dan kepala tabel tidak lagi berhuruf kapital semua.
  - Lencana berbentuk pil lembut.
- **Sidebar:**
  - Kini permukaan terang/gelap, bukan plum gelap.
  - Menu aktif ditandai **titik merah** yang muncul memantul, dan ikonnya
    memerah.
  - Menu bergeser sedikit saat disorot.
  - Logo dengan titik yang melompat.
- **Transisi halaman:** `template.tsx` di (dashboard) dan (auth) membuat isi
  naik-memudar singkat setiap pindah halaman (`motion-safe`).
- **Auth:** form di dalam kartu, dengan kaligrafi تنافس pudar di latar.
- **Warna status** (amber/emerald) diberi varian `dark:`.

### Pratinjau tanpa login

`/pratinjau-tema` (hanya development, 404 di production) menampilkan sidebar
dan semua komponen dasar dengan data contoh. Halaman ini dibuat karena
`DATABASE_URL` lokal menunjuk ke Supabase jarak jauh, sehingga dashboard
sungguhan tidak diuji dengan login akun seed.

### Terverifikasi (Chrome headless)

- Enam halaman (pratinjau dashboard, login, daftar, 403, beranda, onboarding)
  memakai latar dan font brand, dan mengikuti tema sistem, terang maupun gelap.
- Tombol tema:
  - pilihan tersimpan;
  - kedua tombol di halaman ikut berganti label;
  - setelah muat ulang dengan sistem **terang**, halaman sudah gelap saat
    DOMContentLoaded (tanpa kedipan);
  - diklik lagi kembali terang.
- Tidak ada error atau peringatan hidrasi.

**Belum diperiksa manual:** halaman dashboard sungguhan dengan data, karena
tidak login ke basis data jarak jauh. Kelasnya sama dengan pratinjau, tetapi
tabel dan formulir khusus perlu dicek sekali dengan akun sungguhan.

---

## Pembaruan 2026-09-30 (12): titik hero di tempat tetap, transisi tema biasa

- **Titik merah hero kini mendarat di SATU tempat tetap** untuk semua huruf:
  di luar sudut kanan atas gabungan tinta kesepuluh huruf (`titikTetap` di
  `motion-root.tsx`).
  - Sebelumnya tempatnya diukur dari tinta tiap huruf, sehingga melompat-lompat
    (ط dan ظ tinggi, ر pendek, ض lebar).
  - Kini titik melompat naik lalu memantul kembali ke titik yang sama setiap
    kali huruf berganti.
  - Karena berada di luar gabungan tinta semua huruf, titik tidak pernah
    berada di atas huruf mana pun, jadi tidak ada risiko terbaca sebagai
    i'jam.
  - Label makhraj/sifat dan tampilan diam (gerak dikurangi) memakai tempat yang
    sama.
  - Terverifikasi: posisi titik identik untuk 10 huruf, di lebar 1280 dan 390;
    tidak ada label yang menabrak titik atau keluar kolom.
- **Transisi tema:** lingkaran yang membesar (650 ms) dan ikon yang memantul
  diganti crossfade biasa 200 ms `ease-out`. Ikon matahari/bulan kini hanya
  berputar dan memudar 200 ms, tanpa pantulan.
