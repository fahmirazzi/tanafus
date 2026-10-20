import type { MetadataRoute } from "next";
import { getSiteUrl, hasCanonicalDomain } from "@/lib/site-url";

/**
 * Yang di-disallow mengikuti matcher middleware (src/middleware.ts): semua
 * yang butuh login. Bukan soal keamanan — middleware yang menjaganya — tapi
 * supaya crawler tidak membuang crawl budget pada ratusan URL yang selalu
 * berakhir di halaman login.
 *
 * Selama NEXT_PUBLIC_SITE_URL belum disetel (preview/lokal), seluruh situs
 * ditutup. Preview Vercel yang terindeks akan bersaing dengan domain asli
 * untuk konten yang sama persis.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  if (!hasCanonicalDomain()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/teacher/",
          "/parent/",
          "/notifications/",
          "/login",
          "/register",
          "/403",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
