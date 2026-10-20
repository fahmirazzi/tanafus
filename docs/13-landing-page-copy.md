# Copy Halaman Depan — Tanafus Center *(PENSIUN)*

> ## ⚠️ PENSIUN (2026-09-30)
>
> Copy v1 ini milik halaman depan berbasis brand v1, yang sudah diarsipkan di
> `docs/archive/landing-v1-brand/`. Copy yang berlaku:
> [16-landing-v3-copy.md](16-landing-v3-copy.md). Jangan menulis copy baru dari
> dokumen ini. Riset makna nama yang dirujuk di sini tetap berlaku
> ([11-brand-guidelines.md](11-brand-guidelines.md) §2).

Sumber copy untuk `lms-tahsin/src/app/page.tsx`. Kalau copy di halaman berubah,
ubah di sini juga — dokumen ini yang direview, bukan JSX-nya.

Mengikuti [11-brand-guidelines.md](11-brand-guidelines.md) (suara, kosakata,
larangan) dan `.agents/product-marketing.md` (audiens, keberatan, pesan).

**Satu aksi utama:** menghubungi admin lewat WhatsApp.

---

## ⚠️ Yang belum bisa diisi

Tiga hal ditulis sebagai placeholder dan **harus diisi sebelum halaman ini
dipublikasikan**:

| Placeholder | Di mana | Kenapa kosong |
|---|---|---|
| Nomor WhatsApp | Semua CTA | Belum ada di repo. Dibaca dari env `NEXT_PUBLIC_WHATSAPP_NUMBER`. |
| Tarif | Bagian "Biaya" | Angka di `prisma/seed.ts` adalah data demo, bukan harga resmi. |
| Kredensial guru | FAQ "Gurunya siapa?" | Sertifikasi/sanad yang boleh diklaim belum ditentukan. |

Tidak ada testimoni dan tidak ada angka capaian di halaman ini — belum ada yang
bisa dikutip secara jujur. Begitu ada, tempat paling berpengaruh untuk
menaruhnya adalah tepat di bawah hero.

---

## 1. Hero

**Headline**
> Bagaimana Anda tahu bacaan anak Anda membaik?

**Subheadline**
> Tahsin privat online, satu guru satu murid. Setiap sesi dinilai dengan rubrik
> yang sama — makharijul huruf, sifatul huruf, tajwid, kelancaran — dan catatan
> gurunya bisa Anda buka kapan saja.

**CTA utama:** Tanya lewat WhatsApp
**CTA sekunder:** Lihat guru privat → `/instructors`

**Baris kecil di bawah tombol**
> Sesi yang tidak terjadi tidak ditagih.

### Alternatif headline

- **A (dipakai):** "Bagaimana Anda tahu bacaan anak Anda membaik?" — pertanyaan
  retoris yang menamai persis keraguan yang sudah ada di kepala orang tua. Tidak
  menuduh siapa pun, tidak menakut-nakuti, dan jawabannya adalah produknya.
- **B:** "Bacaan anak Anda, dengan catatan yang bisa Anda baca sendiri" —
  pernyataan transformasi, lolos tes "Now you can". Lebih aman, lebih datar.
- **C:** "Tahsin privat online yang meninggalkan bukti" — paling padat, tapi
  "bukti" terdengar defensif, seolah ada yang perlu dibuktikan.

### Alternatif CTA

- **A (dipakai):** "Tanya lewat WhatsApp" — jujur soal apa yang terjadi
  berikutnya. Ini percakapan, bukan pendaftaran.
- **B:** "Hubungi kami di WhatsApp" — netral, sedikit lebih formal.
- **C:** "Konsultasi gratis lewat WhatsApp" — konversi kemungkinan lebih tinggi,
  tapi "gratis" menempelkan bahasa promo pada percakapan yang memang tidak
  ditagih. Tidak dipakai.

---

## 2. Masalah

**Judul**
> Mengaji rutin, tapi hasilnya tidak pernah tercatat

**Isi**
> Anak mengaji setiap pekan. Bulan berganti, juz bertambah, dan setiap kali
> ditanya jawabannya sama: "Alhamdulillah, lancar."
>
> Lancar belum tentu benar. Dan sebagian besar orang tua — termasuk yang rajin
> mengaji sendiri — tidak cukup percaya diri untuk menilai makhraj anaknya.
>
> Ini bukan salah gurunya. Memang tidak ada catatan apa pun yang tertinggal dari
> sebuah sesi ngaji.

*Catatan: bagian ini paling berisiko melanggar aturan "jangan memakai rasa
bersalah". Kalimat ketiga adalah pengamannya — tekanannya pada tidak adanya
catatan, bukan pada kelalaian orang tua atau kekurangan guru.*

---

## 2a. Kutipan: ayat tartil

Ditempatkan setelah bagian "Masalah" — menjembatani "tidak ada catatannya" ke
"kenapa ketelitian bacaan itu penting sejak awal".

> وَرَتِّلِ ٱلْقُرْءَانَ تَرْتِيلًا
>
> "dan bacalah Al-Qur'an itu dengan tartil."
>
> — QS. Al-Muzzammil: 4

*Catatan: ini ayat rujukan utama untuk tartil/tahsin, jadi tidak perlu dicari
pembenarannya — memang persis topik halaman ini. Aturan pemakaian nash ada di
[11-brand-guidelines.md](11-brand-guidelines.md) §6a.*

---

## 3. Cara kerja

**Judul**
> Empat langkah, mulai dari satu pesan

1. **Ceritakan kondisi anak Anda**
   Umurnya berapa, sudah sampai mana bacaannya, kapan waktu luangnya. Cukup
   lewat WhatsApp.
2. **Kami carikan gurunya**
   Kami cocokkan dengan guru yang jamnya bersesuaian, lalu jadwal pekanannya
   ditetapkan.
3. **Sesi privat online**
   Satu guru satu murid, 30, 45, atau 60 menit. Tidak ada murid lain di ruangan
   itu.
4. **Nilai dan catatan masuk hari itu juga**
   Empat kriteria dinilai, catatan gurunya ditulis, dan koreksi suaranya bisa
   Anda dengarkan ulang.

---

## 4. Yang membedakan

**Judul**
> Yang tidak ditinggalkan ngaji biasa

| Judul kartu | Isi |
|---|---|
| **Dinilai, bukan dikira-kira** | Makharijul huruf, sifatul huruf, tajwid, kelancaran. Empat kriteria yang sama di setiap sesi, sehingga perkembangannya bisa dilihat sebagai grafik, bukan sebagai kesan. |
| **Bayar sesi yang terjadi saja** | Guru berhalangan, sesi diliburkan — tidak ada tagihan, dan jatah Anda tidak hangus. Anak sakit atau sedang bepergian? Jadwalnya dijeda, slotnya tetap milik Anda. |
| **Anda melihat semuanya** | Jadwal, nilai, catatan guru, dan tagihan terbuka untuk orang tua. Tidak perlu bertanya untuk tahu. |
| **Guru yang tetap** | Anak belajar dengan guru yang sama setiap pekan — bukan siapa pun yang kebetulan sedang kosong. |

---

## 5. Rubrik

**Judul**
> Empat hal yang dinilai setiap sesi

> **Makharijul huruf** — tempat keluarnya huruf. Apakah ض benar-benar ض.
> **Sifatul huruf** — sifat huruf: tebal-tipis, tertahan, berdesis.
> **Tajwid** — hukum bacaan: panjang-pendek, dengung, waqaf.
> **Kelancaran** — mengalir tanpa tersendat, tanpa mengorbankan tiga hal di atas.

**Penutup bagian**
> Nilainya tersimpan setiap sesi. Setelah beberapa pekan, yang terbaca bukan lagi
> satu angka, tapi arahnya.

*Catatan: bagian ini melakukan pekerjaan yang tidak bisa dilakukan testimoni
mana pun saat ini. Kekhususannya sendiri yang jadi bukti — pihak yang menyebut
empat kriteria dengan nama aslinya jelas benar-benar menilainya.*

---

## 6. Biaya

**Judul**
> Biaya

> Tarif dihitung per sesi, sesuai durasi. Anda bisa memilih ditagih per sesi
> atau sekali sebulan.
>
> **[TARIF — BELUM DIISI]**
>
> Tidak ada biaya pendaftaran. Tidak ada kontrak tahunan. Sesi yang tidak
> terjadi tidak ditagih.

*Catatan: jangan menayangkan halaman ini tanpa angka. Halaman tahsin tanpa harga
memaksa orang tua bertanya lebih dulu hanya untuk tahu apakah mereka mampu — dan
sebagian besar tidak akan bertanya.*

---

## 7. Pertanyaan yang sering muncul

**Mengaji kan harus bertatap muka. Apa bisa online?**
> Tahsin adalah koreksi lisan: guru mendengar, lalu membetulkan. Lewat video satu
> guru satu murid, guru mendengar satu suara saja — lebih dekat daripada di
> ruangan berisi lima belas anak yang mengaji bergantian. Yang tidak bisa
> digantikan memang ada, dan kami tidak mengklaim sebaliknya. Tapi untuk
> memperbaiki bacaan, telinga yang fokus lebih menentukan daripada jarak.

**Gurunya siapa?**
> **[KREDENSIAL GURU — BELUM DIISI]** Profil setiap guru bisa dilihat di halaman
> [guru privat](/instructors) sebelum Anda memutuskan.

**Anak saya belum bisa baca Arab sama sekali. Bisa ikut?**
> Bisa. Guru menetapkan levelnya di awal, dan setiap murid privat berjalan di
> levelnya sendiri — tidak mengejar kelas mana pun.

**Kalau kami sedang bepergian atau anak sakit?**
> Jadwalnya dijeda. Selama jeda tidak ada sesi yang dibuat dan tidak ada tagihan
> yang terbit, sementara slot pekanan Anda tetap tersimpan.

**Untuk dewasa juga?**
> Ya. Sebagian murid adalah orang dewasa yang sudah bisa membaca tapi ingin
> memperbaiki tajwidnya tanpa harus mengulang dari kelas anak-anak.

**Bagaimana sesinya dijalankan?**
> **[APLIKASI SESI — BELUM DIISI]**

---

## 7a. Arti nama Tanafus

Ditempatkan sebelum ajakan terakhir, sebagai bagian tersendiri — tidak
ditempel pada tombol CTA (§6a brand guidelines). Riset dan sumbernya ada di
[11-brand-guidelines.md](11-brand-guidelines.md) §2 "Makna nama".

**Judul**
> Arti nama Tanafus

**Kutipan**
> خِتٰمُهٗ مِسْكٌ ۗ وَفِيْ ذٰلِكَ فَلْيَتَنَافَسِ الْمُتَنٰفِسُوْنَ
>
> "Laknya terbuat dari kasturi. Untuk (mendapatkan) yang demikian itu hendaknya
> orang berlomba-lomba."
>
> — QS. Al-Muthaffifin: 26 (teks & terjemahan Kemenag, dicek via NU Online)

**Isi**
> *Tanafus* berarti saling berlomba. Dalam bahasa Arab, sesuatu disebut *nafīs* —
> berharga — justru karena ia diperlombakan. Yang kami perlombakan adalah bacaan
> Al-Qur'an yang benar.
>
> Tapi yang berlomba bukan anak melawan anak. Balasan dalam ayat ini tidak habis
> dibagi; satu orang meraihnya tidak mengurangi bagian orang lain. Karena itu
> tidak ada peringkat di Tanafus. Setiap murid hanya dibandingkan dengan dirinya
> sendiri pekan lalu.
>
> Surah yang sama dibuka dengan peringatan bagi orang yang curang dalam menakar
> dan menimbang. Kami memegangnya sebagai pengingat: menilai dengan jujur, dan
> tidak menagih sesi yang tidak terjadi.

*Catatan: paragraf kedua melakukan dua pekerjaan sekaligus. Ia menafsirkan nama
secara jujur (balasan di ayat 26 memang bukan barang langka), dan ia menjawab
kecemasan orang tua yang tidak terucap — bahwa "berlomba" berarti anaknya akan
dibandingkan dan kalah. Paragraf ketiga mengikat nama ke dua pembeda utama
(penilaian dan tagihan) tanpa mengklaim ayat itu menjamin mutu kami.*

**Menggantikan** hadits "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ" (HR.
Bukhari) yang sebelumnya di posisi ini. Alasannya dua: ayat asal nama lebih
tepat untuk bagian ini, dan hadits itu menyimpan satu-satunya rujukan yang
belum diverifikasi di halaman. Keduanya kini jadi cadangan.

**Kutipan cadangan** (batas dua kutipan per halaman):
- Hadits "sebaik-baik kalian adalah yang belajar Al-Qur'an dan mengajarkannya"
  (HR. Bukhari) — ⚠️ nomor belum diverifikasi. Cocok untuk halaman guru.
- Hadits tentang orang yang membaca dengan terbata-bata mendapat dua pahala
  (HR. Muslim) — ⚠️ belum diverifikasi. Cocok untuk halaman murid dewasa, untuk
  meredakan rasa malu.

---

## 8. Penutup

**Judul**
> Mulai dari satu pesan

**Isi**
> Ceritakan kondisi bacaan anak Anda. Kami jawab apa adanya — termasuk kalau
> menurut kami yang Anda butuhkan bukan kami.

**CTA:** Tanya lewat WhatsApp

*Catatan: kalimat terakhir adalah pembalik risiko yang tidak berbiaya dan tidak
bisa ditiru dengan mudah. Pihak yang bersedia mengatakan "mungkin bukan kami"
lebih dipercaya daripada yang menjamin cocok untuk semua orang.*

---

## Meta

**Title:** Tahsin Privat Online untuk Anak dan Dewasa — Tanafus Center
*(60 karakter, kata kunci utama di depan, merek di belakang)*

**Meta description:** Bimbingan tahsin privat online satu guru satu murid.
Setiap sesi dinilai empat kriteria dan catatannya terbuka untuk orang tua. Sesi
yang tidak terjadi tidak ditagih.
*(159 karakter)*

**Kata kunci yang dibidik:** tahsin privat online · belajar tahsin online · guru
ngaji privat online · memperbaiki bacaan Al-Qur'an · tahsin anak

---

## Changelog

- **2026-09-28** — Hadits sebelum penutup diganti bagian "Arti nama Tanafus"
  dengan QS. Al-Muthaffifin: 26, mengikuti riset makna nama. Halaman kini tidak
  memuat rujukan yang belum diverifikasi. Motif bintang dinamai dengan benar:
  Rub el Hizb (۞), bukan "khatam".
- **2026-09-24** — Halaman dijadikan berbasis ilustrasi: kartu contoh penilaian
  pindah dari hero ke bagian rubrik (di sanalah pembaca baru tahu arti keempat
  angkanya), hero diisi ilustrasi sesi. Ditambahkan dua kutipan nash (§2a ayat
  tartil, §7a hadits) beserta syarat verifikasinya. SEO: judul beranda kini
  memuat nama merek, deskripsi dipendekkan ke 155 karakter, ditambah canonical
  dan Open Graph.
- **2026-09-22** — Draf pertama. Tarif, kredensial guru, aplikasi sesi, dan nomor
  WhatsApp masih placeholder.
