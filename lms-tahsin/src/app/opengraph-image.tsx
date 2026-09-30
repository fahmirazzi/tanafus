import { ImageResponse } from "next/og";

/**
 * Kartu pratinjau tautan (WhatsApp, media sosial) untuk halaman depan v3.
 * Versi berbasis brand ada di docs/archive/landing-v1-brand/opengraph-image.tsx.
 *
 * TIDAK ada huruf Arab di kartu ini, dan itu disengaja. Satori (mesin di
 * balik next/og) tidak melakukan shaping teks Arab, dan parser fontnya
 * menolak Noto Naskh Arabic ("lookupType: 5 - substFormat: 3 is not yet
 * supported", 500 saat dicoba 2026-09-29). Menggambar ض sebagai path SVG
 * buatan tangan akan menghasilkan huruf yang salah bentuk. Kartu memakai dua
 * motif lain halaman: gelombang suara dan titik merah harakat.
 */
export const alt =
  "Tanafus Center. Pastikan bacaan Al-Qur’an anak Anda benar. Les tahsin privat online, dinilai setiap sesi.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const W = {
  paper: "#F4F4F1",
  ink: "#141413",
  muted: "#5B5B56",
  red: "#C8261B",
};

/** Sama dengan GELOMBANG di src/app/page.tsx. */
const GELOMBANG = [
  0.12, 0.13, 0.18, 0.31, 0.39, 0.4, 0.47, 0.35, 0.46, 0.45, 0.71, 0.63, 0.61,
  0.52, 0.53, 0.81, 0.54, 0.9, 0.65, 0.58, 0.67, 0.72, 0.98, 0.59, 0.81, 0.56,
  0.71, 0.78, 0.8, 0.87, 0.58, 0.53, 0.52, 0.8, 0.67, 0.69, 0.58, 0.41, 0.55,
  0.37, 0.62, 0.39, 0.37, 0.25, 0.26, 0.27, 0.13, 0.12,
];
const PUNCAK = GELOMBANG.indexOf(Math.max(...GELOMBANG));

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: W.paper,
          padding: "68px 84px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <span style={{ fontSize: 34, color: W.ink, letterSpacing: "-0.02em" }}>
            Tanafus
          </span>
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: 999,
              backgroundColor: W.red,
              marginLeft: 3,
              marginBottom: 9,
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              lineHeight: 1.04,
              color: W.ink,
              letterSpacing: "-0.035em",
            }}
          >
            Pastikan bacaan Al-Qur’an anak Anda benar.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: 30,
              color: W.muted,
            }}
          >
            Les tahsin privat online. Dinilai setiap sesi, bayar per sesi.
          </div>
        </div>

        {/* Gelombang suara; titik merah jatuh di puncaknya. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 120,
            position: "relative",
          }}
        >
          {GELOMBANG.map((h, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                width: 7,
                height: `${Math.round(h * 100)}%`,
                borderRadius: 999,
                backgroundColor: i === PUNCAK ? W.red : W.ink,
              }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
