import path from "path";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Di Vercel, kode client hasil bundling Turbopack tidak lagi bertetangga
 * langsung dengan file generated/prisma seperti sebelum di-bundle, jadi
 * resolusi path relatif bawaan Prisma untuk query engine meleset satu
 * folder (mencari .../src/generated, bukan .../src/generated/prisma) —
 * walau file .so.node-nya sendiri terbukti ikut ter-deploy dengan benar
 * (dipaksa lewat outputFileTracingIncludes di next.config.ts). Override
 * langsung ke path absolut supaya Prisma tidak perlu menebak.
 */
if (process.env.VERCEL && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(
    process.cwd(),
    "src/generated/prisma/libquery_engine-rhel-openssl-3.0.x.so.node",
  );
}

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
