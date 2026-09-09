import path from "node:path";
import { Font, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { ReportCardDocument } from "./document";
import type { ReportCardPdfData } from "./data";

/**
 * Font Arab untuk rapor (spec B4 §4.6).
 *
 * WAJIB TTF: fontkit — yang dipakai @react-pdf/renderer — menolak WOFF/WOFF2,
 * jadi berkas dari CDN Google Fonts tidak bisa dipakai langsung.
 *
 * Berkasnya harus ikut terbundel ke fungsi serverless Vercel; itu diurus
 * outputFileTracingIncludes di next.config.ts, mekanisme yang sudah dipakai
 * untuk query engine Prisma dengan alasan yang persis sama.
 */
let registered = false;

function registerFonts(): void {
  if (registered) return;
  Font.register({
    family: "Naskh",
    src: path.join(
      process.cwd(),
      "src/lib/report-card-pdf/fonts/NotoNaskhArabic-Regular.ttf",
    ),
  });
  registered = true;
}

export async function renderReportCardPdf(
  data: ReportCardPdfData,
): Promise<Buffer> {
  registerFonts();
  // renderToBuffer mengetik parameternya sebagai ReactElement<DocumentProps>
  // (props milik <Document> bawaan @react-pdf/renderer), padahal yang kita
  // kirim adalah elemen ReportCardDocument dengan props { data } sendiri —
  // secara struktur tidak nyambung meski ReportCardDocument me-render
  // <Document> di dalamnya. Ini keterbatasan tipe pembungkus komponen di
  // definisi upstream, bukan ketidakcocokan run-time: cast ini aman karena
  // ReportCardDocument SELALU me-render <Document> sebagai akarnya.
  return renderToBuffer(
    createElement(ReportCardDocument, { data }) as ReactElement<DocumentProps>,
  );
}
