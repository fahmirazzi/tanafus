import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getSiteUrl } from "@/lib/site-url";
import { SKRIP_TEMA } from "@/lib/tema";
import { Providers } from "@/components/providers";
import { amiri, jakarta, ruqaa } from "@/components/landing/fonts";

/*
 * Font brand v2 untuk SELURUH aplikasi (bukan hanya halaman depan):
 * Plus Jakarta Sans untuk teks dan judul, Amiri untuk teks Arab (ayat,
 * hadits, huruf hijaiyah; harakatnya tidak bertabrakan), Aref Ruqaa hanya
 * untuk kaligrafi dekoratif. Lihat src/components/landing/fonts.ts.
 */

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Tanpa metadataBase, Next memancarkan URL relatif di og:image/og:url dan
  // sebagian besar pembaca pratinjau (termasuk WhatsApp) mengabaikannya.
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Tanafus Center",
    template: "%s · Tanafus Center",
  },
  description: "Membina Bacaan Al-Qur'an dengan Terukur",
  openGraph: {
    siteName: "Tanafus Center",
    locale: "id_ID",
    type: "website",
  },
  // Gambar diambil dari opengraph-image.tsx; ini hanya meminta kartu besar.
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: skrip tema di <head> menambah kelas `.dark`
    // pada <html> sebelum React hidup; DOM itulah yang benar.
    <html
      lang="id"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        "font-sans",
        jakarta.variable,
        amiri.variable,
        ruqaa.variable,
        geistMono.variable,
      )}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
