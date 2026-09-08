import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Prisma client generates to src/generated/prisma (bukan node_modules),
  // jadi @vercel/nft tidak otomatis melacak query engine binary-nya
  // (dimuat lewat path dinamis saat runtime, bukan require() statis).
  // Tanpa ini, fungsi serverless di Vercel kehilangan file .so.node-nya.
  outputFileTracingIncludes: {
    "/*": [
      "./src/generated/prisma/**/*",
      // Font PDF dibaca lewat path runtime (process.cwd()), bukan import
      // statis, jadi @vercel/nft tidak melihatnya — persis alasan yang sama
      // dengan query engine Prisma di baris atas.
      "./src/lib/report-card-pdf/fonts/**/*",
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          reportOnly: process.env.SECURITY_CSP_ENFORCE !== "true",
        }),
      },
    ];
  },
};

export default nextConfig;
