# Desain Fase 2 — Rilis B3 (Tagihan Periode)

Tanggal: 2026-09-07
Status: menunggu review owner
Rilis sebelumnya: B2 (utang B1 + enrollment kapasitas + placement) — selesai, merged ke `main` (PR #6)

---

## 1. Tujuan Rilis

B3 mengimplementasikan **tagihan periode untuk kelas reguler** (BR-04.8, BR-04.6b) —
potongan berikutnya dari urutan rilis yang disarankan spec B1 (§6): setelah
"enrollment & placement" (B2), berikutnya adalah "tagihan periode". Sampai
rilis ini, murid kelas reguler bisa didaftarkan (B1, B2) tapi TIDAK PERNAH
ditagih — `EnrollmentCharge` belum ada sama sekali di kode (dikonfirmasi:
nol referensi di seluruh `prisma/` dan `src/`), dan `Invoice.periodId` adalah
kolom placeholder mati (`String?` polos, bukan relasi sungguhan) sejak
Fase 1.

Sekalian menutup satu celah nyata yang ditemukan saat riset rilis ini:
**BR-04.6a (pencabutan suspensi otomatis saat lunas) sudah disetujui sebagai
aturan resmi tapi TIDAK ADA kode yang mengimplementasikannya** — satu-satunya
jalur pencabutan suspensi hari ini adalah aksi manual admin
(`DELETE /api/students/[id]/suspension`), dan komentar dokumentasi di file
itu sendiri secara eksplisit (dan sekarang keliru) menyatakan pencabutan
"sengaja tidak otomatis". B3 memperbaikinya sekalian karena jalur kodenya
(pelunasan invoice) persis yang sedang diperluas untuk periode.

Rujukan: `docs/superpowers/specs/2026-09-04-fase-2-kelas-reguler-design.md`
§4.4 (desain asli `EnrollmentCharge`, belum pernah diimplementasikan),
`docs/03-business-rules.md` BR-04 (BR-04.6, BR-04.6a, BR-04.6b, BR-04.8,
BR-04.9 — semua sudah berstatus aturan resmi, bukan usulan).

**Sengaja di luar lingkup B3:** penilaian kohort, rapor & PDF, registrasi
mandiri dewasa & intent, proration/refund (BR-04.9 sudah eksplisit: tidak
ada refund otomatis untuk apa pun), dan 9 utang B1 sisanya (#4–12) plus
minor-minor yang di-park dari review B2. Semuanya kandidat B4+.

---

## 2. Lingkup

| Area | Deskripsi |
|---|---|
| Model data | `EnrollmentCharge` baru; `InvoiceItem.enrollmentChargeId` (sibling `sessionChargeId`); `Invoice.periodId` naik dari `String?` polos jadi relasi sungguhan ke `AcademicPeriod` |
| Charge di muka | `EnrollmentCharge` dibuat otomatis saat admin mendaftarkan murid (POST enrollment) — `installmentNo=1`, `amount` disnapshot dari `ClassGroup.price`, `dueDate` H+7 |
| Cicilan | Admin bisa mengubah charge yang masih `pending` dan belum ter-invoice menjadi N charge, tanggal & jumlah ditentukan admin per cicilan (bukan pembagian otomatis) |
| Penerbitan tagihan | Aksi admin manual per class group ("Terbitkan tagihan") — bukan otomatis saat enrollment, bukan cron baru. Satu charge → satu invoice |
| Void | Perluasan kecil pada route void yang sudah ada — mendeteksi tipe charge dan membuka kembali charge yang sesuai |
| Suspensi periode (BR-04.6b) | Perluasan cron `billing-overdue` yang sudah ada — `Enrollment.status = suspended`, bukan `User.suspendedAt` |
| Pencabutan otomatis (BR-04.6a + BR-04.6b) | Baru untuk keduanya — privat DAN periode, dipicu dari `syncInvoicePayment` |

---

## 3. Desain

### 3.1 Model data

Tambahan model baru:

```prisma
model EnrollmentCharge {
  id            String       @id @default(uuid())
  enrollmentId  String
  installmentNo Int
  amount        Decimal      @db.Decimal(12, 2)
  dueDate       DateTime     @db.Date
  status        ChargeStatus @default(pending) // pakai ulang enum SessionCharge
  createdAt     DateTime     @default(now())
  enrollment    Enrollment    @relation(fields: [enrollmentId], references: [id])
  invoiceItems  InvoiceItem[]

  @@unique([enrollmentId, installmentNo])
}
```

`ChargeStatus` (`pending | invoiced | void`) dipakai ulang apa adanya dari
`SessionCharge` — menjaga satu kosakata status charge di seluruh aplikasi,
persis seperti `InvoiceStatus` dipakai ulang untuk invoice periode (di bawah).

**Perubahan model yang sudah ada:**

```prisma
// Enrollment — tambahkan relasi balik
charges EnrollmentCharge[]

// InvoiceItem — sibling sessionChargeId
enrollmentChargeId String?           @unique
enrollmentCharge   EnrollmentCharge? @relation(fields: [enrollmentChargeId], references: [id])

// Invoice — periodId naik dari String? polos jadi relasi sungguhan
periodId String?
period   AcademicPeriod? @relation(fields: [periodId], references: [id])

// AcademicPeriod — relasi balik
invoices Invoice[]
```

`Invoice.periodId` hari ini (`prisma/schema.prisma`, model `Invoice`) adalah
`String?` polos dengan komentar `// untuk reguler (fase 2)` — sudah
diprediksi sejak spec B1 tapi tidak pernah dinaikkan jadi relasi karena
tidak ada yang menulisnya. Menaikkannya jadi relasi FK sungguhan sekarang
memberi `Invoice` jalan resmi menunjuk periode ajarnya, dipakai saat
penerbitan tagihan periode (§3.3).

**Invarian yang ditegakkan di kode, bukan constraint DB** (BR-04.8): "satu
invoice tidak pernah mencampur charge privat dengan charge periode." Karena
issuer periode (§3.3) HANYA PERNAH membuat `InvoiceItem` dengan
`enrollmentChargeId` terisi dan `sessionChargeId` kosong (dan sebaliknya
untuk `invoice-issuer.ts` privat yang sudah ada), invarian ini terjaga
by construction tanpa perlu CHECK constraint.

`InvoiceStatus.draft` (`draft | issued | paid | partial | overdue | void`)
tetap TIDAK DIPAKAI oleh desain ini — desain §3.3 menerbitkan invoice
langsung sebagai `issued` begitu admin memicunya (aksi admin manual ITU
SENDIRI adalah gerbang konfirmasi; menambah status `draft` perantara di
atasnya tidak menambah nilai). `draft` tetap dicadangkan untuk kebutuhan
masa depan, bukan cacat rilis ini.

### 3.2 Charge di muka + konversi cicilan

**Charge otomatis saat enrollment.** `POST /api/class-groups/[id]/enrollments`
([enrollments/route.ts](../../../lms-tahsin/src/app/api/class-groups/[id]/enrollments/route.ts))
hari ini TIDAK dibungkus `prisma.$transaction` — create/reactivate enrollment
adalah panggilan `prisma.*` biasa. B3 membungkusnya dalam `$transaction` dan
menambah pembuatan `EnrollmentCharge` setelah enrollment berhasil:

```ts
const charge = await tx.enrollmentCharge.create({
  data: {
    enrollmentId: enrollment.id,
    installmentNo: 1,
    amount: group.price, // disnapshot — perubahan ClassGroup.price nanti
                          // tidak berlaku surut, sejalan BR-03.4
    dueDate: addDaysToKey(zonedDateKey(new Date()), 7), // H+7, sama dengan
                                                          // konvensi due date
                                                          // invoice yang ada
    status: "pending",
  },
});
```

Hanya dibuat untuk enrollment BARU (bukan reaktivasi murid yang pernah
`dropped` — reaktivasi mempertahankan charge lama jika masih ada dan belum
diselesaikan, tidak membuat charge kedua untuk kelas yang sama). Kalau
murid yang direaktivasi TIDAK punya charge tersisa sama sekali (mis. charge
lamanya sudah lunas dan diselesaikan penuh sebelum ia sempat `dropped`),
satu charge baru dibuat — aturan praktisnya: "enrollment aktif tanpa charge
apa pun yang belum lunas selalu mendapat satu charge baru saat
create-atau-reaktivasi", bukan murni "hanya saat create".

**Konversi cicilan.** Endpoint baru `POST /api/enrollments/[id]/installments`,
admin-only. Body: `{ installments: [{ amount, dueDate }, ...] }`. Aturan:

- Hanya berlaku selama SEMUA charge `pending` milik enrollment itu belum
  ter-invoice (tidak ada `InvoiceItem` yang menunjuknya) — begitu satu saja
  sudah ter-invoice, konversi ditolak (422).
- Jumlah `amount` seluruh cicilan baru HARUS sama dengan total charge lama
  yang digantikan — cicilan adalah pemecahan jadwal bayar, bukan perubahan
  harga. Perubahan harga adalah keputusan admin terpisah (edit
  `ClassGroup.price`, hanya berlaku untuk enrollment berikutnya).
- Admin menentukan `amount` dan `dueDate` tiap cicilan secara eksplisit —
  BUKAN pembagian otomatis rata N — supaya tidak perlu logika pembulatan
  sisa bagi yang tidak habis dibagi, dan admin bebas membuat cicilan pertama
  lebih besar dari yang berikutnya kalau memang begitu kesepakatannya.
- Transaksional: hapus seluruh charge `pending` lama milik enrollment itu,
  buat N charge baru dengan `installmentNo` 1..N. Berlaku juga untuk
  MENGKONVERSI ULANG (charge yang sudah dipecah jadi cicilan boleh dipecah
  ulang selama belum ada satu pun yang ter-invoice) — endpoint ini
  menggantikan SELURUH charge pending yang belum ter-invoice, bukan hanya
  charge tunggal awal.

### 3.3 Penerbitan tagihan (aksi admin manual)

BR-04.8 memisahkan "charge dibuat saat enrollment dikonfirmasi" dari
"charge-nya belum ter-invoice" sebagai dua peristiwa berbeda — ada jeda di
antaranya, tempat admin bisa mengonversi ke cicilan. Jeda itu ditutup oleh
aksi admin, bukan cron baru: tombol **"Terbitkan tagihan"** di halaman
detail class group.

`POST /api/class-groups/[id]/issue-invoices`, admin-only. Untuk SETIAP
enrollment aktif di class group itu, ambil SEMUA `EnrollmentCharge` berstatus
`pending` yang belum ter-invoice, dan terbitkan **satu invoice per charge**
(bukan menggabungkan beberapa charge satu murid jadi satu invoice — beda
dari `monthly_bundle` privat yang memang mengakumulasi; di sini simpelnya
dijaga karena admin sudah mengontrol kapan menerbitkan). Untuk murid dengan
3 charge cicilan pending, klik ini menerbitkan 3 invoice sekaligus, masing-
masing dengan `dueDate` sesuai `charge.dueDate` sendiri (bukan H+7 dari hari
penerbitan — tanggal jatuh tempo cicilan sudah ditentukan admin saat
konversi, dan tetap berlaku terlepas kapan dokumen invoice-nya dibuat).

Fungsi baru `issueEnrollmentChargeInvoice(tx, chargeId, actorId)` di file
BARU `src/lib/enrollment-invoice-issuer.ts` — TIDAK memodifikasi
`invoice-issuer.ts` yang sudah ada (itu 100% khusus `SessionCharge`, dan
menyentuhnya berisiko ke jalur billing privat yang hidup — retro B1 sendiri
menandai ini sebagai risiko bernama). Fungsi baru ini meniru BENTUK
`issueInvoice` (nomor invoice lewat `nextInvoiceSequence(tx)`, `Invoice.create`
dengan `items: { create: [...] }`, `writeAudit(action: "issue")`, notifikasi
`invoice_issued`) tapi membaca dari `EnrollmentCharge`, bukan `SessionCharge`,
dan mengisi `Invoice.periodId` dari `enrollment.classGroup.periodId`.
Deskripsi baris item baru, `periodeItemDescription(classGroupName,
installmentNo, totalInstallments)` di `src/lib/invoices.ts` — analog
`sessionItemDescription` yang sudah ada tapi berbunyi mis. "Biaya periode
Tahsin Dasar A — Cicilan 1/3" (atau tanpa "— Cicilan N/M" kalau cuma satu
charge).

Helper murni yang dipakai ulang APA ADANYA dari `src/lib/invoices.ts`:
`formatInvoiceNumber`, `dueDateKeyFor` (tidak dipakai di sini karena due
date sudah dari charge, bukan dihitung H+7 dari hari ini), `statusAfterPayments`,
`INVOICE_LIST_SELECT`/`INVOICE_DETAIL_SELECT`. Halaman
`admin/invoices/page.tsx` dan `parent/billing/page.tsx` SUDAH generik atas
model `Invoice` — dikonfirmasi lewat riset, keduanya query `Invoice` tanpa
filter mode privat/periode apa pun. **Tidak perlu ubahan di kedua halaman
itu** — invoice periode langsung tampil begitu barisnya ada.

### 3.4 Void

Route yang sudah ada,
[invoices/[id]/void/route.ts](../../../lms-tahsin/src/app/api/invoices/[id]/void/route.ts),
diperluas — bukan endpoint baru, supaya satu tombol "Void" admin tetap
berlaku untuk invoice apa pun terlepas asalnya. Langkah "buka kembali charge"
(yang hari ini hanya `tx.sessionCharge.updateMany(...)`) bercabang: baca
`invoice.items`, kelompokkan berdasarkan FK mana yang terisi
(`sessionChargeId` vs `enrollmentChargeId`), jalankan `updateMany` ke tabel
yang sesuai untuk masing-masing kelompok. Karena invarian §3.1 menjamin satu
invoice tidak pernah campur, dalam praktiknya hanya satu cabang yang punya
baris — tapi kodenya ditulis menangani keduanya, bukan mengasumsikan.
Sisa langkah (guard idempotency, hapus `InvoiceItem`, `writeAudit`,
notifikasi) TIDAK berubah.

### 3.5 Suspensi periode (BR-04.6b) + pencabutan otomatis (BR-04.6a, BR-04.6b)

**Langkah 1 (tandai overdue) di `billing-overdue.ts` TIDAK PERLU diubah** —
sudah generik atas `Invoice.status`/`dueDate`, tidak peduli charge di
baliknya `SessionCharge` atau `EnrollmentCharge`. Riset mengonfirmasi ini.

**Langkah 2 (suspensi) diperluas dengan langkah 2b baru, khusus periode.**
Kueri paralel ke yang sudah ada, tapi menyaring invoice yang item-nya
menunjuk `enrollmentCharge` (bukan `sessionCharge`), dan alih-alih
`tx.user.updateMany({ suspendedAt: ... })`, jalankan
`tx.enrollment.updateMany({ where: { id: enrollmentId, status: { not: "suspended" } }, data: { status: "suspended" } })`
— level ENROLLMENT, bukan level USER, karena BR-04.6b eksplisit: "kohort
tidak bisa dihentikan per keluarga", jadi yang diblokir hanya pendaftaran
class group berikutnya untuk murid itu, bukan seluruh akunnya. `reason`
disimpan sebagai `writeAudit(entity: "Enrollment", action: "suspend",
newData: { reason, invoiceId })` — `Enrollment` tidak punya kolom
`suspensionReason` sendiri (tidak perlu — audit log sudah menyimpan
alasannya, dan level enrollment tidak butuh field tampilan cepat seperti
`User.suspensionReason` yang dipakai badge UI di banyak tempat).

**Penegakan.** `POST /api/class-groups/[id]/enrollments` menolak (422)
pendaftaran baru bila murid itu punya BARIS `Enrollment` mana pun berstatus
`suspended` — bukan mencocokkan "periode berikutnya" secara spesifik
(disederhanakan, disetujui owner: efek praktiknya sama — memblokir sampai
diselesaikan — dan menghindari logika pencocokan periode-berikutnya yang
rumit tanpa manfaat nyata).

**Pencabutan otomatis — untuk KEDUANYA (BR-04.6a privat, BR-04.6b periode).**
Titik pemicu tunggal: `syncInvoicePayment` di `src/lib/payments.ts`
(dipanggil baik dari webhook Midtrans maupun rute verifikasi admin manual,
keduanya sudah di dalam `tx`), tepat setelah `nextStatus === InvoiceStatus.paid`
ditentukan (baris tempat notifikasi `invoice_paid` dikirim hari ini):

- **Cabang privat:** kalau invoice ini `SessionCharge`-based, cek apakah
  murid itu (`invoice.studentId`) masih punya invoice `overdue` lain. Kalau
  tidak ada lagi, DAN `User.suspensionReason` diawali penanda
  `"[Otomatis] "` (lihat di bawah), jalankan langkah yang SAMA PERSIS dengan
  `DELETE /api/students/[id]/suspension` (guard `updateMany` pada
  `NOT: { suspendedAt: null }`, `writeAudit(action: "unsuspend")` — nilai
  action-nya `"unsuspend"`, bukan action baru, supaya riwayat audit satu
  murid tetap satu vocabulary — dengan `oldData` mencatat sumbernya
  otomatis, notifikasi `student_unsuspended`).
- **Cabang periode:** kalau invoice ini `EnrollmentCharge`-based, cari
  `enrollmentId`-nya, cek apakah enrollment itu masih punya invoice
  `overdue` lain. Kalau tidak, dan `Enrollment.status === "suspended"`,
  `updateMany` balik ke `"active"`, `writeAudit(entity: "Enrollment",
  action: "unsuspend")`, notifikasi `student_unsuspended` (dipakai ulang —
  generik "sesi/pendaftaran dibuka kembali", tidak perlu tipe baru).

**Penanda `"[Otomatis] "` pada `suspensionReason` (khusus cabang privat).**
BR-04.6a eksplisit: "Admin tetap bisa menangguhkan akun secara manual untuk
sebab lain, dan pencabutan manual itu keputusan admin" — jadi pencabutan
otomatis TIDAK BOLEH menimpa suspensi yang sebabnya bukan tunggakan. Karena
`User.suspensionReason` adalah teks bebas tanpa kolom sumber terpisah,
`billing-overdue.ts` langkah 2 (yang menulis `reason`) diubah menambahkan
awalan tetap: `` `[Otomatis] Tagihan ${invoice.invoiceNumber} terlambat
${overdueDays} hari` ``. Pencabutan otomatis di `syncInvoicePayment` HANYA
berjalan kalau `suspensionReason` yang tersimpan diawali penanda itu — kalau
admin men-suspend manual dengan alasan lain (teks apa pun tanpa awalan itu),
pelunasan tidak pernah mencabutnya secara diam-diam.

**Perbaikan komentar yang sudah salah.** Doc comment di
[students/[id]/suspension/route.ts](../../../lms-tahsin/src/app/api/students/[id]/suspension/route.ts)
(baris 16–23) menyatakan "Sengaja tidak otomatis mengikuti pelunasan:
aturannya menyebut pencabutan sebagai keputusan admin" — ini BENAR untuk
pencabutan MANUAL (endpoint ini tetap satu-satunya jalur manual, tidak
dihapus), tapi kalimatnya sekarang menyesatkan karena membaca seolah TIDAK
ADA jalur otomatis sama sekali. Diperbarui menjelaskan endpoint ini
khusus manual, dan menunjuk ke `syncInvoicePayment` untuk jalur otomatis.

---

## 4. Risiko

| Risiko | Mitigasi |
|---|---|
| Migrasi terhadap database produksi (model baru + kolom baru) | Jalur `migrate diff --from-schema-datasource ... --to-schema-datamodel ...` (TANPA `--shadow-database-url` — proyek ini tidak punya shadow database terpisah, memakainya pernah menghapus seluruh data; lihat retro B1 §1); verifikasi isi `migration.sql` non-kosong sebelum `migrate deploy`; verifikasi kolom balik dari `information_schema` setelah deploy, bukan percaya pesan sukses |
| `POST /api/class-groups/[id]/enrollments` sekarang dibungkus transaksi baru — perubahan pada jalur yang sudah dipakai B1/B2 | Perubahan aditif (bungkus dengan `$transaction`, tambah satu `create`); logika pengecekan kapasitas/audience/existing-enrollment yang sudah ada TIDAK diubah urutannya, hanya dipindah ke dalam `tx` |
| Pencabutan otomatis salah menimpa suspensi manual yang sebabnya bukan tunggakan | Penanda `"[Otomatis] "` pada `suspensionReason` — pencabutan otomatis hanya membaca penanda itu, tidak pernah menyimpulkan dari absennya invoice overdue saja |
| Fungsi issuer periode baru mendupilkasi sebagian bentuk `issueInvoice` privat | Disengaja (lihat §3.3) — YAGNI terhadap generalisasi prematur pada kode privat yang hidup dan sensitif finansial lebih penting daripada DRY di sini, konsisten dengan retro B1 §4 lesson 2 |
| Route void yang sudah ada disentuh (bukan aditif murni) | Perubahan sempit: hanya langkah "buka kembali charge" yang bercabang tipe; guard idempotency, hapus item, audit, notifikasi tidak disentuh |

---

## 5. Kriteria Penerimaan (ringkas)

- Mendaftarkan murid ke class group otomatis membuat satu `EnrollmentCharge`
  (`installmentNo=1`, jumlah = harga kelas saat itu, jatuh tempo H+7).
- Admin bisa mengubah charge yang masih pending & belum ter-invoice menjadi
  N cicilan dengan jumlah dan tanggal yang ia tentukan sendiri; totalnya
  harus sama dengan charge asli.
- Konversi ditolak begitu charge (atau salah satu cicilannya) sudah
  ter-invoice.
- Tombol "Terbitkan tagihan" di class group menerbitkan satu invoice per
  charge pending untuk semua enrollment aktif, tanpa menyentuh jalur
  penerbitan invoice privat sama sekali.
- Invoice periode muncul apa adanya di halaman tagihan admin dan tagihan
  orang tua, tanpa perubahan kode di kedua halaman itu.
- Void terhadap invoice periode membuka kembali `EnrollmentCharge`-nya ke
  `pending`; void terhadap invoice privat tetap berperilaku sama seperti
  sebelumnya.
- Invoice periode yang overdue > 14 hari men-suspend `Enrollment` (bukan
  `User`) murid itu; pendaftaran class group baru untuk murid itu ditolak
  selama ada baris `Enrollment` berstatus `suspended`.
- Melunasi seluruh invoice overdue milik satu murid (privat) atau satu
  enrollment (periode) mencabut suspensi terkait secara otomatis — KECUALI
  suspensi privat itu disebabkan alasan manual non-tunggakan (tidak
  memakai penanda `"[Otomatis] "`), yang tetap harus dicabut admin.

---

## 6. Yang Sengaja Tidak Dikerjakan

| Tidak dikerjakan | Konsekuensi yang diterima |
|---|---|
| Proration & refund keluar/masuk tengah periode | BR-04.9 sudah eksplisit menutup ini — admin menyesuaikan manual lewat void + invoice pengganti |
| Cron baru untuk penerbitan tagihan otomatis | Admin memicu manual per class group; kalau lupa, tagihan menumpuk sebagai charge `pending` tanpa batas waktu (tidak ada peringatan "charge belum ditagih" — kandidat B4 kalau jadi masalah nyata) |
| Pembagian cicilan otomatis (rata N) | Admin selalu memasukkan jumlah & tanggal tiap cicilan sendiri |
| `InvoiceStatus.draft` dipakai untuk representasi "belum ditagih" | Charge `pending` tanpa invoice sudah cukup mewakili keadaan itu; `draft` tetap dicadangkan, tidak dipakai rilis ini |
| Utang B1 #4–12 dan minor B2 yang di-park | Tetap ada, didokumentasikan di retro B1 §3 dan ledger review B2; kandidat B4+ |
