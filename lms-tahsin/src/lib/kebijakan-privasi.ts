/**
 * Isian kebijakan privasi (/kebijakan-privasi) yang HANYA bisa diisi pemilik
 * lembaga: identitas pengendali data, kontak, dan keputusan yang menyangkut
 * kewajiban hukum. Sengaja tidak dikarang. Selama nilainya `null`, halaman
 * menampilkan penanda "Wajib diisi pemilik" di tempatnya, dan halaman tidak
 * diindeks mesin pencari (lihat `kebijakanMasihDraf`).
 *
 * Cara mengisi: ganti `null` dengan teksnya, persis seperti yang ingin
 * tampil di halaman. Bagian lain kebijakan menjelaskan perilaku aplikasi
 * (ekspor data, hapus akun) dan ditulis di page.tsx; kalau perilakunya
 * berubah, teks di sana yang diperbarui.
 */
export type IsianPemilik = {
  /** Apa yang harus diisi, ditampilkan di penanda selama masih kosong. */
  perlu: string;
  nilai: string | null;
};

export const ISIAN_PEMILIK = {
  namaPengendali: {
    perlu: "nama badan hukum pengelola Tanafus Center (yayasan, PT, CV, atau perorangan)",
    nilai: null,
  },
  alamat: {
    perlu: "alamat surat-menyurat lembaga",
    nilai: null,
  },
  emailPrivasi: {
    perlu: "alamat email untuk permintaan dan pengaduan soal data pribadi",
    nilai: null,
  },
  petugasPelindunganData: {
    perlu: "nama atau jabatan petugas pelindungan data pribadi, atau keterangan bahwa lembaga belum menunjuknya",
    nilai: null,
  },
  tanggalBerlaku: {
    perlu: "tanggal kebijakan ini mulai berlaku",
    nilai: null,
  },
  waktuTanggapan: {
    perlu: "batas waktu lembaga menanggapi permintaan atas data pribadi",
    nilai: null,
  },
  masaSimpanKeuangan: {
    perlu: "berapa lama catatan keuangan tanpa nama disimpan, sesuai kewajiban pembukuan lembaga",
    nilai: null,
  },
  masaSimpanAkunTidakAktif: {
    perlu: "berapa lama data akun yang tidak lagi dipakai disimpan sebelum dianonimkan",
    nilai: null,
  },
  penyediaBasisData: {
    perlu: "nama penyedia basis data dan penyimpanan yang dipakai di produksi",
    nilai: null,
  },
  transferLuarNegeri: {
    perlu: "pernyataan tentang data yang disimpan atau diproses di luar Indonesia oleh penyedia layanan, dan dasar perlindungannya",
    nilai: null,
  },
} satisfies Record<string, IsianPemilik>;

export type KunciIsian = keyof typeof ISIAN_PEMILIK;

/** Masih draf selama ada satu saja isian pemilik yang kosong. */
export function kebijakanMasihDraf(
  isian: Record<string, IsianPemilik> = ISIAN_PEMILIK,
): boolean {
  return Object.values(isian).some((i) => i.nilai === null);
}
