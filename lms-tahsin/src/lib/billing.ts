/**
 * Aturan uang untuk sesi privat (BR-03, BR-05).
 *
 * Fungsi di sini sengaja tidak menyentuh database: pemanggil yang membaca
 * tarif khusus dan tier, lalu menyerahkan angkanya ke sini. Dengan begitu
 * aturan tarif bisa diuji tanpa Postgres, dan query tetap satu tempat di
 * route yang memakainya.
 */

/**
 * Harga satu sesi menurut durasi aktualnya (BR-03.2).
 *
 * Tarif khusus murid menang atas tarif tier (BR-03.3). Kolom customPrice
 * bertipe Json bebas ({"30": 50000, "60": 90000}), jadi isinya diperlakukan
 * sebagai data tak tepercaya: hanya angka positif yang dipakai, sisanya
 * jatuh ke tarif tier. null berarti durasi itu memang belum punya tarif —
 * pemanggil yang memutuskan pesan penolakannya.
 */
export function resolveSessionAmount(input: {
  durationMinutes: number;
  customPrice: unknown;
  tierPrice: number | null;
}): number | null {
  const custom = readCustomPrice(input.customPrice, input.durationMinutes);
  if (custom !== null) return custom;

  return Number.isFinite(input.tierPrice) ? input.tierPrice : null;
}

function readCustomPrice(
  customPrice: unknown,
  durationMinutes: number,
): number | null {
  if (typeof customPrice !== "object" || customPrice === null) return null;

  const raw = (customPrice as Record<string, unknown>)[String(durationMinutes)];
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;

  return raw;
}

/**
 * Upah guru atas sebuah charge (BR-05.1): amount x revenue_share_pct.
 *
 * Dibulatkan ke rupiah penuh karena tidak ada sen dalam transaksi lembaga
 * ini; kolomnya Decimal sehingga pembulatan di sini yang menentukan, bukan
 * pemotongan diam-diam oleh database.
 */
export function computeEarning(
  chargeAmount: number,
  revenueSharePct: number,
): number {
  return Math.round((chargeAmount * revenueSharePct) / 100);
}
