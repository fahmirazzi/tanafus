import { PrismaClient } from "@/generated/prisma/client";

/**
 * Singleton Prisma client.
 * Di development Next.js melakukan hot-reload, sehingga tanpa guard ini
 * setiap reload akan membuat koneksi baru sampai pool Supabase habis.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Pooler Supabase punya latensi ~1 detik per query, sedangkan default
 * interactive transaction Prisma hanya 5 detik. Beri ruang lebih.
 *
 * Tinggal di sini, bukan di users.ts, supaya modul cron dan job billing bisa
 * memakainya tanpa ikut menarik rantai import auth-guard -> next-auth.
 */
export const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;
