const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** Rp 90.000 — semua harga di aplikasi ini rupiah penuh tanpa sen. */
export function formatRupiah(value: number): string {
  return rupiah.format(value);
}
