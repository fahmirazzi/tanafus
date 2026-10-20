/**
 * Pertanyaan form /onboarding dan penyusun pesan WhatsApp-nya.
 *
 * Modul murni (tanpa React) supaya dipakai dua tempat dengan hasil yang
 * sama persis: form itu sendiri, dan contoh pesan di kartu "langkah 1"
 * halaman depan.
 *
 * Jawaban TIDAK disimpan di mana pun. Jawaban hanya disusun menjadi pesan
 * WhatsApp yang dikirim sendiri oleh pengunjung. Kalau kelak disimpan ke
 * basis data, itu data anak: wajib ada persetujuan dan data minimal (UU PDP).
 *
 * Hiasan kartu: kata Arab yang maknanya sesuai pilihan, ditulis besar dan
 * pudar seperti kaligrafi di halaman depan. Aturannya sama: tidak pernah
 * ayat, tidak pernah lafaz Allah.
 */

export type Hiasan =
  | { jenis: "teks"; teks: string; arti: string }
  | { jenis: "titik"; jumlah: number };

export type Pilihan = {
  nilai: string;
  judul: string;
  ket?: string;
  /** Bentuk pilihan ini di dalam pesan WhatsApp. */
  ringkas: string;
  hiasan: Hiasan;
};

export type Jawaban = {
  siapa?: string;
  usia?: string;
  bacaan?: string;
  guru?: string;
  waktu: string[];
  nama: string;
};

export type IdPilihan = "siapa" | "usia" | "bacaan" | "guru" | "waktu";

export type Pertanyaan = {
  id: IdPilihan;
  tanya: (j: Jawaban) => string;
  bantuan?: string;
  /** Boleh memilih lebih dari satu. */
  jamak?: boolean;
  pilihan: Pilihan[];
  /** Pertanyaan dilewati bila fungsi ini bernilai false. */
  tampil?: (j: Jawaban) => boolean;
};

const untukAnak = (j: Jawaban) => j.siapa !== "diri";

export const PERTANYAAN: Pertanyaan[] = [
  {
    id: "siapa",
    tanya: () => "Siapa yang akan belajar?",
    pilihan: [
      {
        nilai: "anak",
        judul: "Anak saya",
        ket: "Les privat untuk anak",
        ringkas: "anak saya",
        hiasan: { jenis: "teks", teks: "طِفْل", arti: "anak" },
      },
      {
        nilai: "diri",
        judul: "Saya sendiri",
        ket: "Untuk remaja dan dewasa",
        ringkas: "saya sendiri",
        hiasan: { jenis: "teks", teks: "أَنَا", arti: "saya" },
      },
    ],
  },
  {
    id: "usia",
    tanya: () => "Berapa usia anak Anda?",
    tampil: untukAnak,
    // Hiasan titik bertambah seiring usia: tema titik halaman depan.
    pilihan: [
      { nilai: "<7", judul: "Di bawah 7 tahun", ringkas: "di bawah 7 tahun", hiasan: { jenis: "titik", jumlah: 1 } },
      { nilai: "7-9", judul: "7 sampai 9 tahun", ringkas: "7–9 tahun", hiasan: { jenis: "titik", jumlah: 2 } },
      { nilai: "10-12", judul: "10 sampai 12 tahun", ringkas: "10–12 tahun", hiasan: { jenis: "titik", jumlah: 3 } },
      { nilai: "13+", judul: "13 tahun ke atas", ringkas: "13 tahun ke atas", hiasan: { jenis: "titik", jumlah: 4 } },
    ],
  },
  {
    id: "bacaan",
    tanya: (j) =>
      untukAnak(j) ? "Sampai mana bacaan anak Anda sekarang?" : "Sampai mana bacaan Anda sekarang?",
    bantuan: "Tidak perlu tepat. Guru akan mendengar bacaannya langsung di pertemuan pertama.",
    pilihan: [
      {
        nilai: "huruf",
        judul: "Belum mengenal huruf hijaiyah",
        ringkas: "belum mengenal huruf hijaiyah",
        hiasan: { jenis: "teks", teks: "أ ب ت", arti: "alif, ba, ta" },
      },
      {
        nilai: "jilid",
        judul: "Sedang belajar per jilid",
        ket: "Iqro', Ummi, atau Tilawati",
        ringkas: "sedang belajar per jilid",
        hiasan: { jenis: "teks", teks: "هِجَاء", arti: "mengeja" },
      },
      {
        nilai: "belum-lancar",
        judul: "Sudah membaca Al-Qur'an, belum lancar",
        ringkas: "sudah membaca Al-Qur'an, belum lancar",
        hiasan: { jenis: "teks", teks: "تِلَاوَة", arti: "bacaan" },
      },
      {
        nilai: "tajwid",
        judul: "Sudah lancar, ingin memperbaiki tajwid",
        ringkas: "sudah lancar, ingin memperbaiki tajwid",
        hiasan: { jenis: "teks", teks: "تَجْوِيد", arti: "tajwid" },
      },
    ],
  },
  {
    id: "guru",
    tanya: () => "Ingin belajar dengan siapa?",
    bantuan: "Kami usahakan sesuai pilihan Anda.",
    pilihan: [
      {
        nilai: "ustadz",
        judul: "Ustadz",
        ket: "Guru laki-laki",
        ringkas: "ustadz",
        hiasan: { jenis: "teks", teks: "أُسْتَاذ", arti: "guru laki-laki" },
      },
      {
        nilai: "ustadzah",
        judul: "Ustadzah",
        ket: "Guru perempuan",
        ringkas: "ustadzah",
        hiasan: { jenis: "teks", teks: "أُسْتَاذَة", arti: "guru perempuan" },
      },
      {
        nilai: "bebas",
        judul: "Siapa saja",
        ket: "Yang jadwalnya paling cocok",
        ringkas: "siapa saja",
        hiasan: { jenis: "teks", teks: "سَوَاء", arti: "sama saja" },
      },
    ],
  },
  {
    id: "waktu",
    tanya: () => "Kapan waktu belajar yang paling cocok?",
    bantuan: "Boleh pilih lebih dari satu.",
    jamak: true,
    pilihan: [
      { nilai: "pagi", judul: "Pagi", ket: "06.00 sampai 11.00", ringkas: "pagi", hiasan: { jenis: "teks", teks: "صَبَاح", arti: "pagi" } },
      { nilai: "siang", judul: "Siang", ket: "11.00 sampai 15.00", ringkas: "siang", hiasan: { jenis: "teks", teks: "ظُهْر", arti: "tengah hari" } },
      { nilai: "sore", judul: "Sore", ket: "15.00 sampai 18.00", ringkas: "sore", hiasan: { jenis: "teks", teks: "عَصْر", arti: "sore" } },
      { nilai: "malam", judul: "Malam", ket: "Setelah Magrib", ringkas: "malam", hiasan: { jenis: "teks", teks: "مَسَاء", arti: "petang" } },
    ],
  },
];

/** Pertanyaan yang berlaku untuk jawaban saat ini (usia dilewati bila belajar sendiri). */
export function pertanyaanAktif(j: Jawaban): Pertanyaan[] {
  return PERTANYAAN.filter((p) => !p.tampil || p.tampil(j));
}

function ringkas(id: IdPilihan, nilai: string | undefined) {
  return PERTANYAAN.find((p) => p.id === id)?.pilihan.find((x) => x.nilai === nilai)?.ringkas;
}

/**
 * Baris-baris pesan WhatsApp dari jawaban. Dipisah per baris supaya contoh
 * di halaman depan bisa merender tiap baris sebagai elemen sendiri.
 */
export function susunBaris(j: Jawaban): string[] {
  const nama = j.nama.trim();
  const siapa = ringkas("siapa", j.siapa);
  const usia = untukAnak(j) ? ringkas("usia", j.usia) : undefined;
  const bacaan = ringkas("bacaan", j.bacaan);
  const guru = ringkas("guru", j.guru);
  const waktu = PERTANYAAN.find((p) => p.id === "waktu")!
    .pilihan.filter((x) => j.waktu.includes(x.nilai))
    .map((x) => x.ringkas);

  const baris = [
    `Assalamu’alaikum, saya ${nama || "…"}. Saya ingin mencari guru tahsin di Tanafus Center.`,
  ];
  if (siapa) baris.push(`• Yang belajar: ${siapa}${usia ? `, usia ${usia}` : ""}`);
  if (bacaan) baris.push(`• Bacaan sekarang: ${bacaan}`);
  if (guru) baris.push(`• Guru: ${guru}`);
  if (waktu.length) baris.push(`• Waktu: ${waktu.join(", ")}`);
  return baris;
}

export function susunPesan(j: Jawaban): string {
  const [salam, ...rincian] = susunBaris(j);
  return [salam, "", ...rincian].join("\n");
}

/** Contoh jawaban untuk kartu "langkah 1" di halaman depan. Nama rekaan. */
export const CONTOH_JAWABAN: Jawaban = {
  siapa: "anak",
  usia: "7-9",
  bacaan: "jilid",
  guru: "ustadzah",
  waktu: ["sore"],
  nama: "Aisyah",
};
