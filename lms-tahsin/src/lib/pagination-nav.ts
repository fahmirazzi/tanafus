/**
 * Penyusun tautan pagination untuk halaman server-rendered (NFR-1).
 *
 * Murni supaya bisa diuji tanpa merender komponen. Yang penting di sini adalah
 * filter yang sedang aktif TIDAK boleh hilang saat pindah halaman — kehilangan
 * filter saat menekan "Berikutnya" adalah bug pagination yang paling sering
 * terjadi dan paling membingungkan pengguna.
 */
export function buildPageHref(
  pathname: string,
  currentParams: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(currentParams)) {
    if (key === "page") continue;
    if (value === undefined || value === "") continue;
    params.set(key, value);
  }
  params.set("page", String(page));
  return `${pathname}?${params.toString()}`;
}

/** Daftar kosong tetap satu halaman, bukan nol. */
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
