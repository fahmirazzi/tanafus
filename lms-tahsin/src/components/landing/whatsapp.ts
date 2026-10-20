/**
 * Tautan WhatsApp untuk halaman publik. Modul murni (tanpa React, tanpa
 * font) supaya bisa dipakai komponen server maupun client, termasuk form
 * /onboarding yang menyusun pesannya sendiri dari jawaban pengunjung.
 *
 * WAJIB sebelum publikasi: setel NEXT_PUBLIC_WHATSAPP_NUMBER (format
 * internasional tanpa "+"). Selama kosong, semua tautan WhatsApp bernilai
 * null dan tombolnya jatuh ke daftar guru.
 */
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export const WHATSAPP_MESSAGE =
  "Assalamu’alaikum, saya ingin bertanya tentang les tahsin privat di Tanafus Center.";

/** Tautan wa.me dengan pesan pembuka terisi, atau null bila nomor belum diatur. */
export function buatTautanWhatsApp(pesan: string): string | null {
  return WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(pesan)}`
    : null;
}

export const whatsappHref = buatTautanWhatsApp(WHATSAPP_MESSAGE);
