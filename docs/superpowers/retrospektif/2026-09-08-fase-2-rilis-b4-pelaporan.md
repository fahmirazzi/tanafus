# Retrospektif — Fase 2 Rilis B4 (Pelaporan)

Rencana: `docs/superpowers/plans/2026-09-07-fase-2-rilis-b4-pelaporan.md`
Spec: `docs/superpowers/specs/2026-09-07-fase-2-rilis-b4-pelaporan-design.md`
Cabang: `worktree-feat-b4-pelaporan` — 35 commit, merge base `7cca437`.

Berkas ini menyimpan bagian **yang masih berguna setelah rilis** dari buku kerja B4
(`.superpowers/sdd/…`, ruang kerja sementara yang dihapus setelah selesai): keputusan
yang mengikat rilis berikutnya, pertanyaan yang menunggu pemilik, dan utang yang
sengaja ditinggalkan. Riwayat lengkap per task ada di pesan commit masing-masing.

---

## 1. Pelajaran proses yang paling mahal

**Review diff buta terhadap satu kelas bug utuh. Yang menangkapnya adalah menjalankan aplikasinya.**

Lima cacat nyata lolos dari pembacaan kode dan baru ketahuan saat aplikasi benar-benar
dijalankan terhadap database dev:

| Cacat | Lolos dari |
|---|---|
| State form tidak menyerap ulang prop setelah `router.refresh()`; sel yang dikosongkan tampak hilang padahal server masih menyimpannya | 2 review penuh, 2 ronde perbaikan |
| `z.coerce.number()` mengubah `null` jadi `0` — menghapus timpaan justru menyimpan nilai akhir NOL | review Task 3 dan Task 6 |
| Dua jalur berbeda bisa menimpa rapor yang sudah terbit (POST susun draft, PATCH) | laporan implementer yang menyatakan jalur itu aman |
| CSV berlabel `published` menampilkan angka hidup yang tidak cocok dengan PDF-nya | review Task 9 |
| Layar admin tidak punya tombol "Susun draft" — admin bisa terkunci di 422 tanpa jalan keluar | seluruh review per-task |

Sejak Task 10, urutannya dibalik: **controller memverifikasi di browser LEBIH DULU, baru
mendispatch reviewer.** Ketiga task ber-UI terakhir lolos dengan lebih sedikit ronde.

**Untuk rilis berikutnya:** untuk task apa pun yang menghasilkan perilaku yang bisa
dijalankan, verifikasi live mendahului review diff — bukan sesudahnya, dan bukan sebagai
pelengkap.

**Cacat rencana menular ke produk.** Tiga cacat B4 berasal dari rencana, bukan dari
implementer: uji nama berkas yang bertentangan dengan implementasinya sendiri, ambang
ukuran PDF 20 KB yang salah secara empiris, dan tombol "Susun draft" yang dijanjikan
tabel struktur berkas tapi tidak pernah disuruh ditulis oleh langkah mana pun.
Pre-flight scan sudah memeriksa berkas-berbagi dan antarmuka produce→consume — **tapi
tidak memeriksa apakah setiap janji di tabel struktur punya langkah yang mewujudkannya.**
Tambahkan pemeriksaan itu.

**Label "plan-mandated" tidak menggugurkan temuan.** Rencana tidak menilai pekerjaannya
sendiri.

---

## 2. Batasan lingkungan yang mengikat rilis berikutnya

**`.env` punya DUA pasangan koneksi.** Baris 8 adalah header `Database Dev`; pasangan
`DATABASE_URL`/`DIRECT_URL` yang AKTIF berada di bawahnya (project ap-northeast-1).
Pasangan yang dikomentari di baris 1-5 (project ap-southeast-2) adalah produksi.
Controller sempat keliru menyebut yang aktif sebagai produksi dan memasang gerbang
backup yang jauh lebih berat daripada risikonya — periksa header sebelum menyimpulkan.

**Baris produksi yang dikomentari itu RUSAK kalau diaktifkan apa adanya.** Host-nya
tertulis `aws-0-ap-#southeast-2.pooler.supabase.com` — ada `#` nyasar di tengah nama
host, sisa URL yang sempat terpotong baris. Betulkan sebelum dipakai.

**Server dev pemilik memegang port 3000** dari checkout utama. `preview_start`
MENGABAIKAN `cwd` di `.claude/launch.json` dan meluncurkan dari checkout utama — sempat
me-restart server pemilik. Server worktree harus dijalankan sendiri di port lain.

**Jalur migrasi non-interaktif tetap berlaku** (retro B1 §1): `migrate diff` → taruh SQL
dengan tangan → `migrate deploy`. Verifikasi dengan membaca balik kolom dari
`information_schema` dan indeks dari `pg_indexes`, bukan dari pesan hijau.

---

## 3. Yang menunggu keputusan pemilik

**a. Narasi guru terkunci selamanya setelah rapor terbit pertama.**
`PATCH /api/report-cards/[id]` menolak rapor `published`, dan tidak ada unpublish.
Penerbitan ulang menghitung ulang ANGKA tapi tidak menyediakan jalan menyunting
`teacherNote`. Salah ketik pada narasi tidak bisa diperbaiki sama sekali — padahal
narasi adalah satu-satunya bagian rapor yang murni tulisan manusia dan paling mungkin
perlu koreksi. Ini konsekuensi langsung dari kriteria "rapor terbit tidak berubah" yang
memang diminta spec, jadi mengubahnya adalah keputusan produk. Pilihannya: izinkan PATCH
narasi pada rapor terbit (melonggarkan pembekuan hanya untuk teks manusia), atau
tambahkan unpublish/tarik-kembali. **Sementara ini layar guru tidak memberi peringatan
apa pun sebelum penerbitan** — satu kalimat peringatan murah dan tidak mendahului
keputusan produk mana pun.

**b. Rapor milik enrollment yang belakangan jadi `dropped` menghilang dari seluruh
layar**, walau barisnya tetap ada di database dan PDF-nya masih bisa diunduh lewat id.
Spec tidak menyatakan perilaku yang diinginkan.

**c. Dua CSV yang diunduh dari dua tautan bersebelahan bisa melaporkan persentase
kehadiran berbeda untuk murid yang sama** pada kelas yang rapornya sudah terbit — CSV
kehadiran sengaja menampilkan angka terkini, CSV rapor menampilkan angka beku. Perbedaan
itu disengaja dan dijelaskan lewat komentar route, tapi komentar route dibaca developer,
bukan admin yang memegang dua spreadsheet.

---

## 4. Sebelum deploy ke produksi

1. **Migrasi `20260907210000_report_card_b4` belum mendarat di project produksi.** SQL-nya
   aditif dan aman, TAPI `UPDATE "GradeCriterion" SET scope='both' WHERE scope='private'`
   **tidak reversibel** dan akan menyentuh baris apa pun yang ber-scope private di sana.
   **Periksa isi `GradeCriterion` produksi lebih dulu** — kalau ada kriteria yang memang
   sengaja privat, migrasinya perlu dipersempit ke keempat nama yang di-seed.
2. **Verifikasi route PDF di preview deployment Vercel.** `Font.register` memakai
   `path.join(process.cwd(), …)`; mekanisme `outputFileTracingIncludes`-nya sudah terbukti
   untuk binary Prisma, tapi jalur font belum pernah dieksekusi di luar mesin lokal, dan
   mode gagalnya adalah 500 yang hanya muncul di produksi. Ini satu-satunya bagian rilis
   yang risikonya belum bisa dipulangkan dengan membaca kode.
3. **Seed kini memaksa `scope: "both"` di cabang `update`.** Benar untuk masalah yang
   diperbaikinya, tapi seed berikutnya akan menimpa kembali `scope` yang sengaja diubah
   orang di database. Jebakan untuk rilis yang menambahkan CRUD rubrik lewat UI.

---

## 5. Utang yang sengaja ditinggalkan

Diurutkan dari yang paling mungkin menggigit.

| # | Utang | Kenapa penting |
|---|---|---|
| 1 | **Nol uji otomatis untuk `src/app/api/**`** — route menyentuh Prisma dan test runner tidak punya database. Sebagian besar invarian rilis ini hidup di route. | Sudah dikurangi: keputusan beku-vs-segar diekstrak jadi `resolveReportCardView()` yang murni dan beruji. Sisanya (gerbang, penjagaan akses, transaksi) masih hanya dijaga verifikasi manual. |
| 2 | **Kegagalan notifikasi per murid saat penerbitan hilang tanpa jejak log.** `Promise.allSettled` di-await tapi hasilnya tidak diperiksa. | Sebelum gelombang perbaikan akhir, tiap murid punya `try/catch` yang mencatat `report_card_publish_notify_failed`. Sinyal diagnostik itu hilang; penerbitan tetap aman. |
| 3 | **`alreadyPublished` di LAYAR admin belum disaring ke enrollment aktif** (route-nya sudah). Kelas yang belum pernah terbit tapi punya satu enrollment `dropped` berapor terbit akan menampilkan tombol "Terbitkan ulang" dan dialog yang berbohong. | Tidak memblokir dan tidak merusak audit — `action` diputuskan per baris di dalam transaksi. |
| 4 | **Biaya transaksi penerbitan tumbuh linier** (~7 pernyataan × jumlah murid) terhadap `timeout: 20_000`. | Timeout DI DALAM transaksi rollback bersih — mode gagal yang aman. Loop pasca-commit sudah dibatch, yang menutup mode gagal yang berbahaya. |
| 5 | Aturan timpaan nilai masih disalin tangan sekali lagi **di dalam** transaksi penerbitan. | Semantiknya identik dengan `effectiveFinalGrade`; sengaja tidak disentuh karena transaksi itu kode paling sensitif di rilis ini. |
| 6 | **Nilai tidak bisa dihapus lewat jalur mana pun** — `PUT /grades` hanya upsert. Nilai yang salah masuk untuk murid yang seharusnya tidak dinilai ikut rata-rata rapor selamanya. | Sesuai spec, dan UI sudah jujur ("Nilai tidak bisa dikosongkan lewat layar ini"). |
| 7 | **CSV tidak menetralkan formula injection** (`=`, `+`, `-`, `@` di awal sel). Nama murid masuk ke sel. | Pola lama sejak laporan sesi Fase 1; B4 menambah dua endpoint yang memakainya. |
| 8 | Nama beraksara non-Latin hilang dari nama berkas CSV (`rekap-kehadiran_.csv`). PDF sudah punya cadangan ke id rapor; CSV belum. | Relevan untuk produk pendidikan Al-Qur'an. |
| 9 | Alasan timpaan nilai tidak pernah sampai ke orang tua — tidak ada di PDF maupun layar progres. | Skema Zod mewajibkannya dengan alasan "harus bisa dipertanggungjawabkan ke orang tua"; pembenaran itu belum dipenuhi. |
| 10 | Class group tak dikenal menghasilkan 403/422, bukan 404, di seluruh endpoint B4. | Konsisten di dalam B4, inkonsisten dengan halaman detail kelas lama. Bukan kebocoran. |
| 11 | Dua tab guru yang sama tidak saling menyegarkan narasi sampai reload penuh. | Pola arsitektur yang sama dengan `session-card.tsx`, bukan regresi B4. |

---

## 6. Keputusan desain yang layak dipertahankan

- **Pembekuan dijaga di sisi TULIS, oleh tiga penulis, masing-masing dengan tulisan
  bersyarat satu pernyataan atau penguncian baris eksplisit.** Bukan dengan pemeriksaan
  terpisah yang bisa dipisahkan oleh balapan. Reviewer akhir memverifikasi ulang bahwa
  hanya ada tiga penulis dan tidak ada jalur keempat.
- **`null` bukan `0`, di setiap lapisan.** Sel input kosong tidak pernah terkirim; skema
  Zod menolak `""` dan `null` alih-alih mengoersinya; kolom database nullable; CSV
  menulis sel kosong; layar menulis "belum bisa dihitung" dan "Belum dinilai". Empat
  ronde perbaikan Task 4 dihabiskan untuk properti ini.
- **Aksara Arab dirender sebagai teks, bukan gambar** — menyimpang dari spec §4.6 dan
  memperbaiki spec-nya, setelah spike membuktikan `@react-pdf/renderer` menangani
  penyambungan huruf, harakat, urutan RTL, dan pembungkusan paragraf dengan benar.
- **Gerbang "kewajiban make-up terbuka" dipertahankan meski pemicunya tak tercapai** —
  B1 mewajibkan setiap pembatalan disertai jadwal pengganti, sehingga kewajiban terbuka
  tidak pernah lahir dari alur normal. Gerbangnya berdiri sebagai pertahanan berlapis
  untuk data lama; kriteria penerimaan §8 spec payung yang diperbaiki, bukan kodenya.
