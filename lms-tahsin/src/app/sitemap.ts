import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { PUBLIC_TEACHER_WHERE } from "@/lib/teachers";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Hanya halaman publik. Halaman di balik login sengaja tidak dimasukkan —
 * lihat src/app/robots.ts.
 *
 * Profil guru memakai PUBLIC_TEACHER_WHERE yang sama dengan direktori publik,
 * supaya sitemap tidak pernah memuat guru yang halamannya justru 404 (mis.
 * guru yang rolenya sudah dicabut).
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const statis: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/instructors`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/tentang`, changeFrequency: "yearly", priority: 0.5 },
  ];

  try {
    const teachers = await prisma.teacherProfile.findMany({
      where: PUBLIC_TEACHER_WHERE,
      select: { userId: true },
    });

    return [
      ...statis,
      ...teachers.map((t) => ({
        url: `${siteUrl}/instructors/${t.userId}`,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // Build Vercel bisa berjalan tanpa akses database. Sitemap tanpa profil
    // guru masih berguna; build yang gagal gara-gara sitemap tidak.
    return statis;
  }
}
