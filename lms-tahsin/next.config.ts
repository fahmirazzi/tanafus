import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma client generates to src/generated/prisma (bukan node_modules),
  // jadi @vercel/nft tidak otomatis melacak query engine binary-nya
  // (dimuat lewat path dinamis saat runtime, bukan require() statis).
  // Tanpa ini, fungsi serverless di Vercel kehilangan file .so.node-nya.
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/**/*"],
  },
};

export default nextConfig;
