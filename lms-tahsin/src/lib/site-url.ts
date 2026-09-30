/**
 * URL kanonik situs, dipakai metadata, robots.txt, dan sitemap.
 *
 * Setel NEXT_PUBLIC_SITE_URL ke domain produksi (mis. https://tanafus.id).
 * Tanpa itu kita jatuh ke VERCEL_URL — benar untuk preview deployment, tapi
 * JANGAN diandalkan di produksi: nilainya berubah tiap deploy, sehingga URL
 * kanonik dan sitemap ikut berubah dan Google melihat situs yang berpindah
 * alamat terus-menerus.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

/** True hanya bila domain produksi sungguhan sudah disetel. */
export function hasCanonicalDomain(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim());
}
