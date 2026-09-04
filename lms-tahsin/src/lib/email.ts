import { Resend } from "resend";

/**
 * Email transaksional via Resend (roadmap item 29, BR-09 kolom "email").
 *
 * Sama seperti Midtrans di midtrans.ts, kredensial dibaca dari environment
 * dan boleh kosong. Lembaga bisa berjalan penuh tanpa email — notifikasi
 * in-app sudah menutup kebutuhan dasar — jadi ketiadaan kunci BUKAN error,
 * melainkan kanal yang tidak diaktifkan. sendEmail menjadi no-op yang aman
 * dipanggil dari mana pun tanpa pengecekan tambahan di sisi pemanggil.
 */

export type EmailConfig = { apiKey: string; from: string };

export function emailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export function isEmailEnabled(): boolean {
  return emailConfig() !== null;
}

let cachedClient: { key: string; client: Resend } | null = null;

/** Satu instance per API key — bukan per pemanggilan, resend.com membatasi
 * koneksi dan membuat klien baru tiap kirim itu pemborosan yang percuma. */
function resendClient(apiKey: string): Resend {
  if (cachedClient?.key !== apiKey) {
    cachedClient = { key: apiKey, client: new Resend(apiKey) };
  }
  return cachedClient.client;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Kirim satu email. TIDAK PERNAH melempar — kegagalan email adalah
 * peristiwa yang wajar (kuota habis, alamat salah, layanan turun) dan tidak
 * boleh menggagalkan permintaan HTTP yang memicunya. Kegagalan dicatat ke
 * log server; notifikasi in-app yang sudah tersimpan tetap jadi sumber
 * kebenaran utama.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const config = emailConfig();
  if (!config) return;

  try {
    const resend = resendClient(config.apiKey);
    const result = await resend.emails.send({
      from: config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (result.error) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "email_send_failed",
          to: input.to,
          subject: input.subject,
          error: result.error,
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "email_send_threw",
        to: input.to,
        subject: input.subject,
        error: String(error),
      }),
    );
  }
}

/** Kirim ke banyak penerima sekaligus, tanpa membiarkan satu kegagalan
 * menghentikan pengiriman ke penerima lain. */
export async function sendEmailToMany(
  recipients: readonly string[],
  build: (to: string) => SendEmailInput,
): Promise<void> {
  await Promise.all(recipients.map((to) => sendEmail(build(to))));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Bingkai HTML sederhana yang dipakai semua email transaksional lembaga.
 * title dan body diperlakukan sebagai teks biasa (di-escape) — keduanya
 * sering memuat nama murid/guru yang diketik pengguna, bukan HTML tepercaya.
 */
export function emailTemplate(params: { title: string; body: string }): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px 20px;color:#3a2a3a">
  <p style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#c2410c;font-weight:600;margin:0 0 16px">Tanafus Center</p>
  <h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(params.title)}</h1>
  <p style="font-size:14px;line-height:1.6;margin:0 0 16px;white-space:pre-line">${escapeHtml(params.body)}</p>
  <p style="font-size:12px;color:#8a7a8a;margin:24px 0 0">Buka aplikasi Tanafus Center untuk rincian lengkap dan tindak lanjut.</p>
</div>`;
}
