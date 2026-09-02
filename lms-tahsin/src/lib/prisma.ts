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
