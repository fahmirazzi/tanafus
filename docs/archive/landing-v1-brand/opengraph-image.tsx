import { ImageResponse } from "next/og";

/**
 * Kartu pratinjau saat tautan dibagikan — terutama ke grup WhatsApp keluarga,
 * karena CTA halaman ini mengarah ke WhatsApp. Tanpa file ini, tautan tampil
 * sebagai URL polos tanpa gambar.
 *
 * Diwarisi oleh semua rute di bawah `/` yang tidak punya opengraph-image
 * sendiri.
 *
 * Font: Noto Sans bawaan ImageResponse — kebetulan memang font body brand.
 * Font bawaan itu HANYA berisi weight regular, jadi `fontWeight: 700` di
 * bawah saat ini diabaikan tanpa pesan. Judul idealnya Playfair Display 600,
 * tapi Satori tidak bisa membaca woff2 yang diunduh next/font; perlu file TTF
 * di repo (seperti src/lib/report-card-pdf/fonts/), dimuat lewat opsi `fonts`
 * ImageResponse. Begitu itu ada, weight 700 di bawah langsung berlaku.
 */
export const alt =
  "Tanafus Center — tahsin privat online, satu guru satu murid, dinilai empat kriteria setiap sesi.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const WARNA = {
  cream50: "#FBFEFB",
  cream100: "#EFE5DC",
  orange500: "#FF7A00",
  plum200: "#DCD6E0",
  plum500: "#7A6B83",
  plum700: "#574B60",
  plum900: "#322C38",
  white: "#FFFFFF",
};

const RUBRIK = [
  { nama: "Makharijul huruf", nilai: 78 },
  { nama: "Sifatul huruf", nilai: 71 },
  { nama: "Tajwid", nilai: 84 },
  { nama: "Kelancaran", nilai: 80 },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: WARNA.cream50,
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* Rub el Hizb (۞) tipis di pojok — dua persegi bertumpuk 45° */}
        {/* Diletakkan di atas kartu, tidak menimpanya — tepi kartu yang
            memotong bintang terlihat seperti kesalahan, bukan komposisi. */}
        <svg
          width="96"
          height="96"
          viewBox="0 0 24 24"
          style={{ position: "absolute", top: 28, right: 64, opacity: 0.22 }}
        >
          <g
            fill="none"
            stroke={WARNA.plum500}
            strokeWidth="0.6"
            strokeLinejoin="round"
          >
            <path d="M4.93 4.93H19.07V19.07H4.93Z" />
            <path d="M12 2 22 12 12 22 2 12Z" />
          </g>
        </svg>

        {/* Kolom kiri: pesan */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 620,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 700,
              color: WARNA.plum900,
            }}
          >
            Tanafus Center
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 60,
                fontWeight: 700,
                lineHeight: 1.12,
                color: WARNA.plum900,
                letterSpacing: "-0.02em",
              }}
            >
              Tahsin privat online, dinilai setiap sesi
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 24,
                fontSize: 28,
                lineHeight: 1.4,
                color: WARNA.plum700,
              }}
            >
              Satu guru satu murid. Catatannya terbuka untuk orang tua.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                width: 48,
                height: 6,
                borderRadius: 3,
                backgroundColor: WARNA.orange500,
              }}
            />
            <div
              style={{
                display: "flex",
                marginLeft: 16,
                fontSize: 24,
                color: WARNA.plum500,
              }}
            >
              Membina Bacaan Al-Qur’an dengan Terukur
            </div>
          </div>
        </div>

        {/* Kolom kanan: kartu penilaian — artefak paling khas produk ini */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: "auto",
            alignSelf: "center",
            width: 380,
            padding: 36,
            borderRadius: 20,
            backgroundColor: WARNA.white,
            border: `2px solid ${WARNA.plum200}`,
          }}
        >
          {RUBRIK.map((r, i) => (
            <div
              key={r.nama}
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: i === 0 ? 0 : 22,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 22,
                  color: WARNA.plum700,
                }}
              >
                <span>{r.nama}</span>
                <span style={{ color: WARNA.plum900, fontWeight: 700 }}>
                  {r.nilai}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: WARNA.cream100,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: `${r.nilai}%`,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: WARNA.orange500,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
