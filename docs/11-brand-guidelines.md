# Brand Guidelines — Tanafus Center

> ## ⚠️ Sebagian besar dokumen ini PENSIUN (2026-09-30)
>
> Brand v1 (plum, oranye, krem; Playfair Display dan Noto Sans) tidak lagi
> dipakai di UI mana pun. Seluruh aplikasi kini memakai **brand v2**: kertas,
> tinta, dan satu merah (merah titik harakat Abu al-Aswad), dengan Plus Jakarta
> Sans dan Amiri. Lihat [14-landing-v2.md](14-landing-v2.md), pembaruan 11.
>
> | Bagian | Status | Pengganti / catatan |
> |---|---|---|
> | §1 Fondasi Brand | Pensiun | Positioning: [15-riset-pasar-dan-positioning.md](15-riset-pasar-dan-positioning.md) §4 |
> | §2 Identitas Nama | **Berlaku** | Riset makna nama; dirujuk docs/15 dan halaman /tentang |
> | §3 Logo | Pensiun | Wordmark "Tanafus" + titik merah (`src/components/layout/logo.tsx`) |
> | §4 Palet Warna | Pensiun | Token `--tf-*` di `lms-tahsin/src/app/globals.css` |
> | §5 Tipografi | Pensiun | Plus Jakarta Sans, Amiri, Aref Ruqaa (`src/components/landing/fonts.ts`) |
> | §6 Ikonografi & Gambar | Pensiun | Arah desain di docs/14 |
> | §6a Mengutip Al-Qur'an dan Hadits | **Berlaku, direvisi** | Lihat catatan revisi di bagian itu |
> | §7 Suara Brand | **Berlaku** | |
> | §8 Gaya Penulisan | **Berlaku** | |
> | §9 Kosakata | Pensiun | Tidak lagi ditegakkan: copy v3 memakai "sesi hangus" dengan sengaja, UI memakai "Dashboard" |
> | §10 Pesan | Pensiun | BrandScript di [16-landing-v3-copy.md](16-landing-v3-copy.md) |
> | §11 Brand dalam Penggunaan | Pensiun | Seluruhnya berbasis palet v1 |
> | §12 Daftar Larangan | Sebagian | Butir warna/font pensiun; butir etika tetap berlaku (ditandai di bagian itu) |
> | §13 Pemilik & Aset | Sebagian | Penunjuk token sudah berubah; daftar "yang masih terbuka" masih relevan |
>
> Bagian yang pensiun dibiarkan utuh sebagai catatan sejarah keputusan, bukan
> pedoman. Jangan membangun UI atau copy baru dari bagian itu.

Identitas resmi Tanafus Center: visual dan verbal. Semua UI, landing page,
email, export PDF, dan materi pemasaran HARUS mengikuti pedoman ini.

**Untuk siapa:** developer yang membangun UI, siapa pun yang menulis copy
(halaman, email, media sosial), dan desainer/mitra eksternal. Tujuannya satu:
orang bisa membuat sesuatu yang terasa "Tanafus" tanpa harus bertanya dulu.

**Sumber kebenaran.** Token warna dan font yang dipakai kode ada di
`lms-tahsin/src/app/globals.css` dan `src/app/layout.tsx`. Dokumen ini dan file
itu harus selalu cocok — kalau berbeda, perbaiki keduanya, jangan salah satu.

> **Riwayat.** Versi sebelumnya dokumen ini terpotong di tengah tabel palet
> (berhenti di baris `| white`), sehingga tipografi, suara brand, dan pesan tidak
> pernah tertulis. Kode sempat menurunkan sendiri skala plum dengan catatan
> "ganti di sini bila doc lengkap tersedia". Versi ini melengkapinya.

---

## 1. Fondasi Brand *(PENSIUN)*

**Misi.** Membuat pembinaan bacaan Al-Qur'an bisa diukur — supaya keluarga tahu
anaknya benar-benar berkembang, bukan sekadar bertambah umur.

**Visi.** Menjadi tempat keluarga Indonesia memperbaiki bacaan Al-Qur'an dengan
bimbingan satu-satu yang terekam, di mana pun mereka tinggal.

**Nilai.**

| Nilai | Artinya dalam praktik |
|-------|----------------------|
| **Terukur** | Setiap sesi dinilai dengan rubrik yang sama. Klaim selalu punya bukti. |
| **Transparan** | Orang tua melihat jadwal, nilai, dan tagihan tanpa perlu meminta. |
| **Adil** | Tidak ada sesi yang ditagih kalau tidak terjadi. Tidak ada upah yang hilang kalau sudah mengajar. |
| **Hormat pada materinya** | Ini Al-Qur'an. Tidak ada hype, tidak ada gimmick, tidak ada urgensi palsu. |
| **Ramah keluarga** | Bahasanya hangat, tidak menggurui, tidak membuat orang tua merasa bersalah. |

**Kepribadian brand:** Hangat · Modern · Terpercaya · Ramah keluarga · Terukur

*(Empat yang pertama sudah ada sejak awal. "Terukur" ditambahkan karena itulah
pembeda yang sebenarnya — dan satu-satunya yang tidak bisa ditiru ngaji informal.)*

**Positioning.** Untuk keluarga Muslim yang ingin anaknya membaca Al-Qur'an
dengan benar tapi tidak punya cara menilai apakah pengajaran yang ada berhasil,
Tanafus Center adalah pembinaan tahsin privat online yang menilai setiap sesi
dengan rubrik tetap dan memperlihatkan hasilnya kepada orang tua — berbeda dari
guru ngaji informal dan TPQ yang tidak meninggalkan catatan apa pun.

---

## 2. Identitas Nama

| Item | Nilai |
|------|-------|
| Nama brand | **Tanafus Center** |
| Nama pendek (UI/space sempit) | Tanafus |
| Tagline | "Membina Bacaan Al-Qur'an dengan Terukur" |

**Kapitalisasi:** "Tanafus Center" — T dan C besar. **Jangan** TANAFUS, tanafus,
atau TanaFus. Dalam kalimat berbahasa Indonesia, tulis lengkap pada penyebutan
pertama, lalu boleh "Tanafus" saja.

### Makna nama

**Tanafus** (تَنَافُس) berarti *saling berlomba*. Kata ini berasal dari akar
ن-ف-س, dan akar yang sama memberi tiga lapis makna yang semuanya dipakai brand
ini:

| Lapis | Isi | Sumber |
|-------|-----|--------|
| **Nafīs — berharga** | «وشيء نفيس أي يتنافس فيه ويرغب» — sesuatu disebut *nafīs* (berharga) karena ia diperlombakan dan diinginkan. Orang hanya berlomba untuk hal yang berharga. | *Lisān al-‘Arab*, Ibnu Manzhur, entri نفس |
| **Karam — kemuliaan** | «نافست في الشيء … إذا رغبت فيه على وجه المباراة في الكرم» — berlomba dalam sesuatu berarti menginginkannya dengan cara saling beradu dalam kemuliaan. | *Lisān al-‘Arab*, entri yang sama |
| **Nafas — napas** | «نَافَسْتُهُ: aku berlomba dengannya hingga napas melampauiku» — berlomba sampai batas napas. | Tafsir Juz ‘Amma, Ibnu ‘Utsaimin — ⚠️ dikutip lewat tafsirweb.com, belum dicek ke kitabnya |

**Ayat asal nama** — QS. Al-Muthaffifin: 26, teks dan terjemahan Kemenag:

> خِتٰمُهٗ مِسْكٌ ۗ وَفِيْ ذٰلِكَ فَلْيَتَنَافَسِ الْمُتَنٰفِسُوْنَ
>
> "Laknya terbuat dari kasturi. Untuk (mendapatkan) yang demikian itu hendaknya
> orang berlomba-lomba."

*Lisān al-‘Arab* menjelaskan ayat ini: «أي وفي ذلك فليتراغب المتراغبون» — untuk
itulah hendaknya orang-orang yang berhasrat, berhasrat.

### Apa artinya bagi brand

**1. Yang diperlombakan adalah sesuatu yang berharga.** Nama ini tidak
mengatakan "kursus". Ia mengatakan: ada sesuatu yang layak diperjuangkan —
bacaan Al-Qur'an yang benar.

**2. Berlomba *menuju*, bukan berlomba *melawan*.** Balasan dalam ayat 26 tidak
terbatas; satu orang meraihnya tidak mengurangi bagian orang lain. Karena itu
di Tanafus **tidak ada peringkat antar-murid**. Setiap murid diukur terhadap
sesinya sendiri pekan lalu — dan produknya memang dibangun begitu: level
individual, grafik tren per murid, tanpa papan peringkat kelas.

> **Aturan tegas:** "Tanafus" tidak pernah dipakai untuk mengadu anak dengan anak
> lain. Tidak ada papan peringkat, tidak ada "murid terbaik pekan ini", tidak ada
> perbandingan nilai antar-anak di materi mana pun. Ini penerapan langsung
> larangan "rasa takut dan rasa bersalah" di §7 — anak yang selalu kalah dalam
> peringkat adalah anak yang berhenti mengaji.

**3. Napas.** Tahsin adalah napas yang dilatih: waqf dan ibtida', panjang mad,
membaca satu napas. Nama ini memuat napas di dalamnya — karena itu gelombang
suara oranye di ilustrasi hero bukan hiasan; itu napas yang sedang dibetulkan.

**4. Takaran yang jujur.** Surah tempat nama ini berasal dibuka dengan:

> وَيْلٌ لِّلْمُطَفِّفِيْنَ
>
> "Celakalah orang-orang yang curang (dalam menakar dan menimbang)!"
> — QS. Al-Muthaffifin: 1 (Kemenag)

Pembeda Tanafus Center justru takaran yang jujur: setiap sesi dinilai dengan
rubrik yang sama, dan hanya sesi yang benar-benar terjadi yang ditagih. **Ayat
ini mengingatkan kami, bukan membenarkan kami.** Jangan pernah menulisnya
seolah Al-Qur'an menjamin mutu Tanafus; tulis sebagai komitmen yang kami pegang.

### Motif: Rub el Hizb

Bintang delapan dari dua persegi bertumpuk 45° adalah **Rub el Hizb** (۞) —
tanda yang dicetak *di dalam mushaf* untuk membagi bacaan menjadi seperempat
hizb. Untuk lembaga tahsin, ini bukan hiasan geometris: ini tanda yang sudah
dilihat setiap pembaca Al-Qur'an saat berhenti membaca. Itulah satu-satunya
motif geometris brand ini.

### Kapan cerita nama dipakai

- **Dipakai:** bagian "Tentang nama" di halaman depan, bio media sosial, unggahan
  perkenalan, halaman tentang kami.
- **Tidak dipakai:** di setiap unggahan, sebagai tagline, atau ditempel pada
  ajakan mendaftar.
- Ayat 26 dan ayat 1 **selalu** dengan terjemahan dan rujukan (§6a), dan hanya
  di dalam cerita nama.

**Tagline tetap** "Membina Bacaan Al-Qur'an dengan Terukur" — ia menjelaskan apa
yang kami kerjakan, dan nama sudah menjelaskan kenapa. Ayat tidak dijadikan
tagline: nash yang diulang-ulang sebagai slogan berubah menjadi hiasan.

---

## 3. Logo *(PENSIUN)*

**Status: belum ada.** `public/` hanya berisi SVG bawaan Next.js
(`next.svg`, `vercel.svg`, dst.) — tidak ada aset logo Tanafus. Sampai ada,
yang berlaku adalah **wordmark**:

- Tulisan "Tanafus Center" dengan **Playfair Display**, weight 600
- Warna `plum-900` di latar terang; `cream-50` di latar gelap atau di atas oranye
- Jangan ditulis dengan font lain, jangan di-italic, jangan diberi efek

**Aturan yang berlaku begitu logo dibuat:**

- **Clear space:** minimal setinggi huruf "T" pada wordmark, di keempat sisi
- **Ukuran minimum:** 24px tinggi untuk digital, 10mm untuk cetak
- **Varian wajib:** horizontal, stacked, ikon saja, dan versi reversed (untuk
  latar gelap)

**Jangan pernah:**

1. Meregangkan atau memiringkan logo (skala harus proporsional)
2. Memberi drop shadow, glow, atau gradient
3. Menaruh di atas foto ramai tanpa container solid
4. Mewarnai di luar palet resmi
5. Memberi outline/stroke
6. Menulis ulang wordmark dengan font lain
7. Menggabungkan logo dengan kaligrafi atau ornamen Arab sebagai satu kesatuan —
   Al-Qur'an adalah materi yang diajarkan, bukan elemen dekorasi merek

---

## 4. Palet Warna *(PENSIUN)*

Token di bawah ini sudah terpasang di `globals.css` sebagai `--brand-*` dan
diekspos ke Tailwind lewat `@theme inline`. **Gunakan nama token, jangan hex
mentah, di dalam kode.**

### Aksen utama — Oranye

| Token | HEX | Peran |
|-------|-----|-------|
| `orange-50` | #FFF4E8 | Background tipis ber-oranye (badge, hover, selected) |
| `orange-500` | **#FF7A00** | ACCENT UTAMA (ciri khas). CTA, tombol utama, highlight, aktif state, progress |
| `orange-600` | #E66E00 | Hover state tombol primary |

### Netral hangat — Cream

| Token | HEX | Peran |
|-------|-----|-------|
| `cream-50` | **#FBFEFB** | Background utama halaman (nyaris putih, nuansa hangat) |
| `cream-100` | **#EFE5DC** | Background section sekunder, kartu lembut, header halaman |
| `white` | #FFFFFF | Permukaan kartu di atas cream, area form, kontainer logo |

### Teks & struktur — Plum

Skala diturunkan dari warna teks resmi **plum-700 `#574B60`**.

| Token | HEX | Peran |
|-------|-----|-------|
| `plum-50` | #F7F5F8 | Background paling tipis |
| `plum-100` | #EFECF1 | Divider halus, background disabled |
| `plum-200` | #DCD6E0 | Border default |
| `plum-300` | #C2B8C9 | Border tegas, placeholder |
| `plum-400` | #9C8DA6 | Teks nonaktif / hint |
| `plum-500` | #7A6B83 | Teks sekunder |
| `plum-600` | #665A6F | Teks sekunder tegas |
| `plum-700` | **#574B60** | **Teks body utama** |
| `plum-800` | #453B4C | Sub-judul |
| `plum-900` | #322C38 | Judul, wordmark |
| `plum-950` | #201C23 | Teks di atas oranye, kontras maksimum |

### ⚠️ Aksesibilitas — wajib dibaca

**Teks putih di atas `orange-500` hanya mencapai rasio kontras 2,6:1.** WCAG AA
menuntut 4,5:1 untuk teks normal dan 3:1 untuk teks besar. Kombinasi ini **gagal
keduanya** — dan saat ini dipakai di beberapa tempat pada ukuran 12–14px:

- `src/app/403/page.tsx:23` — tombol, `text-sm`
- `src/components/layout/sidebar.tsx:341` — item nav aktif
- `src/components/layout/sidebar.tsx:350` — badge, `text-xs`
- `src/app/(dashboard)/admin/invoices/page.tsx:188`

Rasio yang sudah dihitung:

| Kombinasi | Rasio | Status |
|-----------|-------|--------|
| putih di atas `orange-500` | 2,6:1 | ❌ gagal semua level |
| putih di atas `orange-600` | 3,2:1 | ⚠️ hanya untuk teks besar (≥24px, atau ≥18,7px bold) |
| `plum-950` di atas `orange-500` | 6,4:1 | ✅ lolos AA |
| `plum-700` di atas putih | 8,1:1 | ✅ lolos AAA |
| `plum-700` di atas `cream-100` | 6,6:1 | ✅ lolos AA |

**Aturan:** teks di atas `orange-500` memakai **`plum-950`**, bukan putih.
Kalau desain menuntut teks terang di atas oranye, oranye itu harus digelapkan
sampai minimal 4,5:1 — bukan sebaliknya.

Ini bukan sekadar soal kepatuhan. Sebagian pengguna platform ini adalah orang
tua yang membaca di layar ponsel di bawah cahaya matahari, dan oranye terang
adalah warna yang paling cepat hilang di kondisi itu.

### Aturan pemakaian warna

- **Oranye adalah aksen, bukan background halaman.** Satu CTA oranye dominan per
  layar. Kalau semuanya oranye, tidak ada yang menonjol.
- Background halaman default `cream-50`; section selang-seling `cream-100`.
- Kartu putih di atas cream — jangan cream di atas cream tanpa border.
- Border default `plum-200`.
- **Jangan** memakai oranye dan plum sebagai gradient.
- **Jangan** menambah warna di luar palet ini. Butuh warna status (sukses,
  error)? Pakai `--destructive` yang sudah ada di shadcn dan catat di sini.

---

## 5. Tipografi *(PENSIUN)*

Terpasang lewat `next/font/google` di `src/app/layout.tsx`.

| Peran | Typeface | Variabel CSS | Dipakai untuk |
|-------|----------|--------------|---------------|
| Judul | **Playfair Display** | `--font-heading` | H1–H3, wordmark, angka besar |
| Teks | **Noto Sans** | `--font-sans` | Body, UI, tombol, form, label |
| Mono | **Geist Mono** | `--font-geist-mono` | Kode, ID transaksi, nominal di tabel keuangan |
| Arab | **Noto Naskh Arabic** | `--font-arabic` | Ayat, hadits, potongan teks Arab (lihat §6a) |

**Kenapa Playfair Display.** Serif memberi bobot dan ketenangan yang cocok untuk
materi Qur'an — modern tanpa jadi kaku. **Hanya untuk judul.** Playfair pada
teks panjang melelahkan untuk dibaca, terutama di ponsel.

**Kenapa Noto Sans.** Cakupan karakternya luas (termasuk Arab, kalau nanti
dibutuhkan untuk nama surat atau potongan ayat) dan sangat terbaca pada ukuran
kecil.

### Hierarki

| Level | Font | Weight | Ukuran (mobile → desktop) | Line height |
|-------|------|--------|---------------------------|-------------|
| H1 | Playfair Display | 600 | 32 → 48px | 1,15 |
| H2 | Playfair Display | 600 | 24 → 32px | 1,25 |
| H3 | Playfair Display | 600 | 20 → 24px | 1,3 |
| Body besar | Noto Sans | 400 | 18 → 20px | 1,6 |
| Body | Noto Sans | 400 | 16px | 1,6 |
| Kecil | Noto Sans | 400 | 14px | 1,5 |
| Label | Noto Sans | 500 | 13px | 1,4 |
| Caption | Noto Sans | 400 | 12px | 1,4 |

**Aturan:**

- Ukuran teks body **tidak pernah di bawah 16px** di halaman publik. Sebagian
  pembacanya orang tua yang tidak muda lagi.
- Panjang baris maksimal ~70 karakter.
- Letter spacing: normal untuk body; `-0.02em` untuk H1/H2 Playfair.
- Jangan pakai weight yang tidak dimuat — cek `layout.tsx` sebelum memakai.
- **Fallback:** `Playfair Display, Georgia, serif` dan
  `Noto Sans, system-ui, -apple-system, sans-serif`.

---

## 6. Ikonografi & Gambar *(PENSIUN)*

**Ikon:** `lucide-react` (sudah terpasang). Stroke 1,5–2px, ukuran mengikuti
teks di sebelahnya (`size-4` untuk body). Warna mengikuti teks, bukan oranye —
kecuali ikon itu memang menandai aksi utama.

**Ilustrasi.** SVG inline, digambar sendiri, memakai token warna brand — bukan
stok ilustrasi, bukan aset eksternal. Contoh yang berlaku:
`src/components/landing/illustrations.tsx`.

| Aturan | Alasan |
|--------|--------|
| Sosok digambar **tanpa wajah** | Lazim di materi pendidikan Islam Indonesia, dan menghindarkan kita menggambarkan anak tertentu |
| Bentuk geometris sederhana, bidang datar | Sejalan dengan halaman yang tenang; bukan ilustrasi 3D korporat |
| Garis: stroke 1,5–2,5px, ujung membulat | Selaras dengan ikon |
| Oranye hanya untuk satu hal penting per gambar | Aksen, bukan warna dasar |
| Motif Rub el Hizb (۞) tipis dan terbatas | Penanda bacaan, bukan wallpaper — lihat §2 "Motif" |

**Rub el Hizb (۞)** dibentuk dari **dua persegi bertumpuk 45°** —
bukan bintang empat sudut. Bintang empat sudut adalah ikon "sparkle" generik
dan tidak ada hubungannya dengan motif Islami.

**Hindari pada ilustrasi:** wajah dan ekspresi; kubah dan menara sebagai
hiasan; gradient; bayangan tebal; ilustrasi 3D; maskot.

**Fotografi:** cahaya alami, hangat, suasana rumah. Anak dan guru dalam sesi
nyata. Wajah boleh terlihat **hanya dengan izin tertulis keluarga** — ini anak
kecil, standarnya lebih ketat daripada foto produk biasa.

**Hindari:**

- Stok foto "keluarga Muslim bahagia" yang jelas bukan orang Indonesia
- Masjid megah, kubah, kaligrafi emas sebagai hiasan — brand ini soal belajar,
  bukan soal kemegahan
- Foto mushaf yang diletakkan sembarangan (di lantai, ditumpuk di bawah benda
  lain)
- Ilustrasi 3D corporate, blob gradient, "Memphis style"
- Emoji di dalam produk

---

## 6a. Mengutip Al-Qur’an dan Hadits

> **Revisi 2026-09-30 (bagian ini tetap berlaku):**
> - Font Arab kini **Amiri** (`font-arabic` / `font-ld-arabic`), bukan Noto
>   Naskh Arabic.
> - **Kaligrafi dekoratif diperbolehkan** hanya untuk **kata Arab biasa** yang
>   berkaitan dengan isi bagian (mis. قراءة, نقطة, تنافس), besar dan pudar di
>   latar (`src/components/landing/kaligrafi.tsx`). Ayat dan lafaz Allah **tidak
>   pernah** dijadikan dekorasi. Larangan di bawah tentang "kaligrafi sebagai
>   ornamen" berlaku untuk nash.
> - **Foto mushaf bersejarah** boleh tampil sebagai isi, dengan keterangan dan
>   sumber (mis. foto The Met di /tentang), tidak sebagai latar atau tekstur.

Kutipan nash boleh dipakai, tapi sebagai **isi**, bukan hiasan. Batasnya tegas
dan tidak dinegosiasikan per halaman.

**Wajib:**

1. **Teks Arab lengkap dengan harakat**, dengan `lang="ar"` dan `dir="rtl"`,
   memakai font Arab (`font-arabic` → Noto Naskh Arabic). Font sistem sering
   merusak atau menghilangkan harakat.
2. **Terjemahan bahasa Indonesia** menyertai, selalu.
3. **Rujukan lengkap** — surah dan ayat untuk Al-Qur’an; perawi (dan idealnya
   nomor) untuk hadits.
4. **Diverifikasi ke sumber cetak yang mu’tabar sebelum tayang.** Komponen
   `Kutipan` punya prop `perluVerifikasi` yang menampilkan penanda terlihat
   selama sebuah rujukan belum dicek — penanda itu dibuka hanya setelah ada
   orang berkompeten yang memeriksanya, bukan karena halaman mau dirilis.

**Dilarang:**

- Nash sebagai latar belakang, watermark, atau tekstur di belakang teks lain
- Potongan ayat yang berubah maknanya karena dipenggal
- Nash ditempelkan langsung pada ajakan membeli atau harga
- Kaligrafi sebagai ornamen dekoratif tanpa terjemahan dan rujukan
- Menambah kutipan hanya untuk "menambah nuansa islami"

**Takaran.** Paling banyak dua kutipan per halaman. Halaman yang dipenuhi nash
berhenti menjadi halaman layanan dan berubah menjadi ceramah — dan orang tua
yang datang untuk mencari guru tidak sedang mencari ceramah.

---

## 7. Suara Brand

**Esensi suara:** seperti seorang ustadz yang tenang menjelaskan sesuatu kepada
orang tua murid — jelas, hormat, tanpa menggurui, dan tidak pernah berjualan.

**Dimensi nada:**

| Dimensi | Posisi kita |
|---------|-------------|
| Formal ↔ Santai | Agak formal. "Anda", bukan "kamu". Tapi bukan bahasa surat dinas. |
| Serius ↔ Ringan | Serius tapi hangat. Materinya Al-Qur'an; nada bercanda tidak pada tempatnya. |
| Hormat ↔ Akrab | Hormat. Pembaca adalah orang tua yang sedang mengambil keputusan untuk anaknya. |
| Percaya diri ↔ Rendah hati | Percaya diri pada yang bisa dibuktikan; diam soal yang belum. |

**Kualitas suara:**

| Kualitas | Lakukan | Jangan |
|----------|---------|--------|
| **Konkret** | "Dinilai empat kriteria setiap sesi" | "Metode pembelajaran terbaik" |
| **Jujur** | "Sesi online, satu guru satu murid" | "Seperti belajar langsung, bahkan lebih baik" |
| **Tidak menyalahkan** | "Banyak orang tua sulit menilai bacaan anaknya sendiri" | "Jangan biarkan anak Anda salah baca seumur hidup" |
| **Tenang** | "Slot tersedia setiap pekan" | "BURUAN! Kuota terbatas!!" |
| **Hormat** | "guru ngaji", "ustadz/ustadzah" | Menyindir atau merendahkan guru ngaji yang ada |

**Aturan yang tidak bisa ditawar:** jangan pernah memakai rasa takut atau rasa
bersalah orang tua sebagai alat jualan. Tidak ada "anak Anda tertinggal", tidak
ada hitungan mundur, tidak ada kuota palsu. Kalau sebuah kalimat membuat orang
tua merasa gagal, kalimat itu dibuang — berapa pun konversinya.

---

## 8. Gaya Penulisan

- **Bahasa:** Indonesia. Istilah keislaman (tahsin, tajwid, makhraj, ustadz)
  dipakai apa adanya, tanpa tanda kutip dan tanpa dijelaskan seperti kepada
  orang asing.
- **Kalimat:** pendek. Rata-rata di bawah 20 kata. Satu gagasan per kalimat.
- **Sapaan:** "Anda" untuk orang tua dan murid dewasa.
- **Angka:** angka untuk harga, durasi, dan jumlah (30 menit, Rp 50.000, 4
  kriteria). Huruf untuk angka satu sampai sepuluh di dalam kalimat naratif.
- **Harga:** format Indonesia — `Rp 50.000`, dengan spasi setelah "Rp" dan titik
  sebagai pemisah ribuan.
- **Waktu:** format 24 jam (16.00), hari ditulis penuh (Senin).
- **Kapitalisasi judul:** sentence case. "Cara kerja sesi privat", bukan "Cara
  Kerja Sesi Privat".
- **Tanda baca:** hindari tanda seru. Hindari ALL CAPS. Titik tiga seperlunya.
- **Al-Qur'an** ditulis begitu — dengan hubung dan apostrof.

---

## 9. Kosakata *(PENSIUN)*

**Kita pakai:** tahsin · bacaan · tajwid · makhraj · ustadz/ustadzah · murid ·
sesi · progres · terukur · privat · bimbingan · pekan · jadwal · orang tua ·
rubrik penilaian

**Kita hindari:**

| Jangan | Kenapa | Pakai |
|--------|--------|-------|
| LMS, platform, dashboard | Bahasa internal. Orang tua tidak membeli software. | halaman, jadwal, catatan progres |
| user, customer, klien | Dingin. | murid, orang tua, keluarga |
| onboarding | Jargon. | pendaftaran, sesi perkenalan |
| kelas online | Membuatnya terdengar seperti kelas beramai-ramai. | sesi privat online |
| kursus | Terdengar seperti bimbel. | pembinaan, bimbingan |
| revolusioner, terbaik, nomor 1 | Klaim tanpa bukti. | klaim spesifik yang bisa ditunjukkan |
| gratis! promo! diskon! | Tidak sesuai materi. | sebut harganya apa adanya |

**Glosarium untuk pembaca luar** (istilah internal yang **tidak** boleh bocor ke
copy tanpa dijelaskan): `diliburkan`, `hangus`, `libur murid`, `monthly_bundle`,
`per_session`, `payout`, `earnings`. Padanan yang boleh dipakai ke orang tua:

| Internal | Ke orang tua |
|----------|--------------|
| Sesi diliburkan | "Sesi yang dibatalkan guru tidak ditagih" |
| Libur murid | "Jeda sementara — jadwal berhenti, slot tetap milik Anda" |
| `monthly_bundle` | "Tagihan bulanan" |
| `per_session` | "Bayar per sesi" |

---

## 10. Pesan *(PENSIUN)*

**Pesan inti.** Bacaan Al-Qur'an anak Anda bisa diukur — dan Anda bisa melihat
hasilnya sendiri, setiap pekan.

**Value proposition.** Tanafus Center membina bacaan Al-Qur'an lewat sesi privat
online satu guru satu murid. Setiap sesi dinilai dengan rubrik tetap —
makharijul huruf, sifatul huruf, tajwid, kelancaran — lalu catatan dan koreksi
suaranya bisa Anda buka kapan saja. Sesi yang tidak terjadi tidak ditagih.

**Tagline.** "Membina Bacaan Al-Qur'an dengan Terukur" — dipakai di dekat
wordmark, di header email, dan sebagai sub-judul hero. Bukan headline halaman:
terlalu abstrak untuk membuka percakapan.

**Pesan kunci:**

| Pesan | Bukti |
|-------|-------|
| Progres yang terlihat, bukan kabar baik | Rubrik 4 kriteria dinilai tiap sesi, grafik tren per murid |
| Anda hanya membayar sesi yang benar-benar terjadi | Guru membatalkan → sesi diliburkan, tanpa tagihan, tanpa hangus |
| Satu guru, satu murid | Sesi privat online, bukan kelas beramai-ramai |
| Jadwal yang bertahan | Jeda saat sakit atau bepergian tanpa kehilangan slot |
| Kami menjalankan TPQ sungguhan | Tanafus mengelola TPQ di masjid dengan anak-anak nyata — ⚠️ butuh izin lembaga sebelum dipakai di copy |

---

## 11. Brand dalam Penggunaan *(PENSIUN)*

### Web

- Background `cream-50`; section selang-seling ke `cream-100`
- Judul Playfair Display, body Noto Sans 16px+
- **Satu CTA oranye dominan per layar.** CTA utama saat ini mengarah ke
  **WhatsApp**, bukan form pendaftaran
- Teks tombol oranye memakai `plum-950` (lihat §4 aksesibilitas)
- Tombol: `rounded-md`, padding `px-4 py-2`, tanpa shadow berat
- Teks CTA kata kerja + objek: "Hubungi kami di WhatsApp", bukan "Klik di sini"

### Media Sosial

- Foto profil: wordmark/ikon `plum-900` di atas `cream-50`
- Bio menyebut: tahsin privat online + bukti terukur + cara menghubungi
- Caption mengikuti §7–8: kalimat pendek, tanpa tanda seru, tanpa emoji
  berlebihan (maksimal satu, kalau perlu)
- Jangan pernah memposting foto anak tanpa izin tertulis orang tuanya
- Jangan memposting potongan ayat sebagai latar dekoratif di bawah teks promosi

### Email

- Header: wordmark `plum-900` di atas `cream-50`
- Body plain, kiri rata, 16px, tanpa kolom aneh
- Satu tombol oranye maksimum
- Tanda tangan: nama, peran, "Tanafus Center", kontak
- Email transaksional (tagihan, pengingat sesi) tetap memakai suara brand —
  tenang dan jelas — bukan bahasa sistem

### Cetak & Presentasi

Belum ada kebutuhan aktif. Kalau muncul: judul Playfair Display, body Noto Sans
minimal 11pt, satu aksen oranye per halaman, latar cream atau putih.

---

## 12. Daftar Larangan *(sebagian pensiun)*

Butir bertanda *(pensiun)* terikat pada brand v1 dan tidak lagi berlaku;
butir lainnya tetap berlaku.

- [ ] *(pensiun)* Jangan memakai teks putih di atas `orange-500` — pakai `plum-950`
- [ ] *(pensiun)* Jangan memakai oranye sebagai background halaman
- [ ] *(pensiun)* Jangan lebih dari satu CTA oranye dominan per layar
- [ ] *(pensiun)* Jangan memakai warna di luar palet resmi
- [ ] *(pensiun)* Jangan memakai font di luar Playfair Display / Noto Sans / Geist Mono
- [ ] *(pensiun)* Jangan memakai Playfair Display untuk teks panjang
- [ ] *(pensiun)* Jangan memakai teks body di bawah 16px di halaman publik
- [ ] Jangan menulis TANAFUS, tanafus, atau TanaFus
- [ ] Jangan memakai rasa takut, rasa bersalah, atau urgensi palsu
- [ ] Jangan menyindir atau merendahkan guru ngaji lain
- [ ] Jangan memakai **nash** (ayat, hadits, lafaz Allah) sebagai elemen
      dekorasi — nash hanya tampil sebagai isi, dengan terjemahan dan rujukan.
      Kaligrafi kata Arab biasa dan foto mushaf bersejarah: lihat revisi §6a
- [ ] Jangan menayangkan rujukan hadits yang belum diverifikasi
- [ ] Jangan menggambar wajah pada ilustrasi
- [ ] Jangan memposting wajah anak tanpa izin tertulis
- [ ] Jangan memakai nama data demo (Ustadz Abdurrahman, Fatimah Hasan, dst.) di
      materi mana pun — itu data fiktif dari seed
- [ ] Jangan membocorkan istilah internal (`diliburkan`, `monthly_bundle`) ke
      copy tanpa padanan. *(Pengecualian: copy v3 sengaja memakai "sesi hangus",
      bahasa yang dipakai orang tua sendiri.)*

---

## 13. Pemilik & Aset *(sebagian usang)*

| Item | Status |
|------|--------|
| Pemilik keputusan brand | Owner Tanafus Center |
| Token warna & font | `lms-tahsin/src/app/globals.css` (token `--tf-*`), `src/components/landing/fonts.ts` |
| File logo | Wordmark teks + titik merah: `src/components/layout/logo.tsx`. File gambar logo belum ada |
| Foto | ❌ Belum ada |
| Konteks pemasaran | `.agents/product-marketing.md` |

**Yang masih terbuka:**

1. Logo — belum ada sama sekali; wordmark berlaku sementara
2. Tarif resmi — nilai di `prisma/seed.ts` (Rp 50.000/70.000/90.000) adalah data
   demo, bukan harga publikasi
3. Kredensial guru — sertifikasi/sanad apa yang boleh diklaim?
4. Izin penyebutan TPQ dalam materi pemasaran
5. Nilai status sukses/peringatan belum masuk palet

---

## Changelog

- **2026-09-30** — Sebagian besar dokumen dipensiunkan. Seluruh aplikasi
  pindah ke brand v2 (docs/14, pembaruan 11). Yang tetap berlaku: §2, §6a
  (direvisi: font Amiri, kaligrafi kata biasa, foto mushaf sebagai isi), §7, §8,
  dan butir etika §12. Bagian lain ditandai *(PENSIUN)* dan dibiarkan sebagai
  catatan sejarah.

- **2026-09-24** — Ditambahkan §6a (aturan mengutip Al-Qur’an dan hadits) dan
  aturan ilustrasi pada §6, menyusul keputusan membuat halaman depan berbasis
  ilustrasi dengan kutipan nash. Ditambahkan font Arab (Noto Naskh Arabic,
  `--font-arabic`) ke sistem tipografi. Alasan: batas antara "nash sebagai isi"
  dan "nash sebagai hiasan" harus tertulis sebelum halaman kedua dibuat, bukan
  sesudah.
- **2026-09-22** — Dokumen dilengkapi. Ditambahkan: fondasi brand (misi, visi,
  nilai, positioning), aturan logo/wordmark, skala plum penuh + `white`, audit
  kontras dan aturan aksesibilitas, tipografi lengkap, ikonografi dan gambar,
  suara brand, gaya penulisan, kosakata, kerangka pesan, penerapan di web/sosial/
  email, dan daftar larangan. Alasan: versi sebelumnya terpotong di tengah tabel
  palet, sehingga seluruh identitas verbal tidak pernah tertulis dan kode
  terpaksa menurunkan skala warnanya sendiri.
