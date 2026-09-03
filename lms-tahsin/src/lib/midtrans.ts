import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Integrasi Midtrans Snap (roadmap item 22, PRD F-5d).
 *
 * Kredensial dibaca dari environment dan boleh kosong. Lembaga bisa berjalan
 * penuh tanpa payment gateway — transfer manual sudah menutup kebutuhan
 * dasar — jadi ketiadaan kunci BUKAN error, melainkan kanal yang tidak
 * ditawarkan. Halaman tagihan menyembunyikan tombol bayar online ketika
 * isMidtransEnabled() bernilai false.
 */

export type MidtransConfig = {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
};

export function midtransConfig(): MidtransConfig | null {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  const clientKey = process.env.MIDTRANS_CLIENT_KEY?.trim();
  if (!serverKey || !clientKey) return null;

  return {
    serverKey,
    clientKey,
    // Sandbox adalah default yang aman: salah ketik pada variabel ini tidak
    // boleh diam-diam mengarahkan uang sungguhan.
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  };
}

export function isMidtransEnabled(): boolean {
  return midtransConfig() !== null;
}

function snapBaseUrl(isProduction: boolean): string {
  return isProduction
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
}

/** URL skrip snap.js yang dipasang halaman pembayaran. */
export function snapScriptUrl(isProduction: boolean): string {
  return isProduction
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
}

/**
 * order_id yang unik untuk satu percobaan bayar.
 *
 * Midtrans menolak order_id yang pernah dipakai, sementara satu invoice bisa
 * dicoba berkali-kali (kadaluwarsa, dibatalkan murid). Nomor invoice tetap
 * dijadikan awalan supaya transaksi mudah ditelusuri di dashboard Midtrans.
 * Batas panjang order_id di Midtrans 50 karakter; format ini jauh di bawahnya.
 */
export function buildOrderId(invoiceNumber: string): string {
  return `${invoiceNumber}-${randomBytes(4).toString("hex")}`;
}

// ------------------------------------------------------------- notifikasi

export type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status: string | null;
  payment_type: string | null;
  transaction_id: string | null;
};

/**
 * Bentuk payload webhook divalidasi sejauh yang dipakai saja. Midtrans bebas
 * menambah field baru, dan menolak notifikasi karena ada field asing akan
 * membuat pembayaran yang sah tertahan.
 */
export function parseNotification(body: unknown): MidtransNotification | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;

  const str = (key: string): string | null =>
    typeof raw[key] === "string" ? (raw[key] as string) : null;

  const orderId = str("order_id");
  const statusCode = str("status_code");
  const grossAmount = str("gross_amount");
  const signatureKey = str("signature_key");
  const transactionStatus = str("transaction_status");
  if (
    !orderId ||
    !statusCode ||
    !grossAmount ||
    !signatureKey ||
    !transactionStatus
  ) {
    return null;
  }

  return {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: signatureKey,
    transaction_status: transactionStatus,
    fraud_status: str("fraud_status"),
    payment_type: str("payment_type"),
    transaction_id: str("transaction_id"),
  };
}

/**
 * Tanda tangan Midtrans: SHA-512 dari order_id + status_code + gross_amount
 * + server key.
 *
 * gross_amount WAJIB dipakai apa adanya dari payload ("180000.00"), bukan
 * diformat ulang dari nilai invoice — pemformatan ulang menghasilkan hash
 * berbeda dan akan menolak notifikasi yang sebenarnya sah.
 */
export function expectedSignature(
  notification: Pick<
    MidtransNotification,
    "order_id" | "status_code" | "gross_amount"
  >,
  serverKey: string,
): string {
  return createHash("sha512")
    .update(
      `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`,
    )
    .digest("hex");
}

/**
 * Perbandingan waktu-tetap. Endpoint webhook terbuka untuk umum, dan
 * pembandingan string biasa membocorkan tanda tangan yang benar sedikit demi
 * sedikit lewat selisih waktu respons.
 */
export function verifySignature(
  notification: MidtransNotification,
  serverKey: string,
): boolean {
  const expected = Buffer.from(
    expectedSignature(notification, serverKey),
    "utf8",
  );
  const received = Buffer.from(notification.signature_key, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/**
 * Terjemahan transaction_status Midtrans ke keputusan yang dipahami aplikasi.
 *
 * `capture` pada kartu kredit belum tentu uang bersih: hanya fraud_status
 * "accept" yang dianggap lunas, sedangkan "challenge" menunggu keputusan
 * manual sehingga tetap pending.
 */
export type NotificationOutcome = "paid" | "pending" | "failed";

export function resolveOutcome(
  notification: Pick<
    MidtransNotification,
    "transaction_status" | "fraud_status"
  >,
): NotificationOutcome {
  switch (notification.transaction_status) {
    case "settlement":
      return "paid";
    case "capture":
      return notification.fraud_status === "accept" ? "paid" : "pending";
    case "pending":
      return "pending";
    case "deny":
    case "cancel":
    case "expire":
    case "failure":
      return "failed";
    default:
      // Status baru dari Midtrans diperlakukan sebagai belum selesai, bukan
      // gagal: menandai gagal akan menutup pembayaran yang mungkin sah.
      return "pending";
  }
}

// ------------------------------------------------------------- Snap token

export type SnapItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

/**
 * Terbitkan token Snap. Melempar bila Midtrans menolak, karena pemanggilnya
 * memang tidak punya cara lain menyelesaikan permintaan "buatkan pembayaran".
 */
export async function createSnapToken(params: {
  config: MidtransConfig;
  orderId: string;
  grossAmount: number;
  customer: { name: string; email?: string | null; phone?: string | null };
  items: readonly SnapItem[];
}): Promise<{ token: string; redirectUrl: string }> {
  const auth = Buffer.from(`${params.config.serverKey}:`).toString("base64");

  const response = await fetch(snapBaseUrl(params.config.isProduction), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.grossAmount,
      },
      customer_details: {
        first_name: params.customer.name,
        ...(params.customer.email ? { email: params.customer.email } : {}),
        ...(params.customer.phone ? { phone: params.customer.phone } : {}),
      },
      item_details: params.items.map((item) => ({
        id: item.id,
        name: item.name.slice(0, 50), // Midtrans memotong diam-diam di 50.
        price: item.price,
        quantity: item.quantity,
      })),
    }),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      payload !== null ? JSON.stringify(payload) : `HTTP ${response.status}`;
    throw new Error(`Midtrans menolak permintaan Snap: ${detail}`);
  }

  const data = payload as { token?: unknown; redirect_url?: unknown } | null;
  if (!data || typeof data.token !== "string") {
    throw new Error("Midtrans tidak mengembalikan token Snap");
  }

  return {
    token: data.token,
    redirectUrl: typeof data.redirect_url === "string" ? data.redirect_url : "",
  };
}
