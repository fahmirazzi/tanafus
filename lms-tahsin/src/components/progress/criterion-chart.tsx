import { toPolylinePoints, type ProgressSeries } from "@/lib/progress";
import { formatTanggalWIB } from "@/lib/datetime";

/**
 * Grafik tren satu kriteria rubrik (PRD F-4d, roadmap item 19).
 *
 * Digambar sebagai SVG inline, bukan lewat pustaka chart: yang dibutuhkan
 * hanya satu garis untuk maksimal beberapa belas titik, dan menambah
 * dependensi grafik untuk itu tidak sepadan dengan ukurannya di bundle.
 */

const BOX = { width: 320, height: 80 };

export function CriterionChart({
  series,
  maxScore,
}: {
  series: ProgressSeries;
  maxScore: number;
}) {
  const scores = series.points.map((p) => p.score);
  const points = toPolylinePoints(scores, { ...BOX, maxScore });
  const naik = series.delta !== null && series.delta > 0;
  const turun = series.delta !== null && series.delta < 0;

  return (
    <figure className="space-y-2 rounded-md border border-border p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-plum-800">
          {series.criterionName}
        </span>
        <span className="text-sm text-plum-700">
          {series.latest}
          <span className="text-plum-500">/{maxScore}</span>
          {series.delta !== null ? (
            <span
              className={
                naik
                  ? "ml-2 text-emerald-700"
                  : turun
                    ? "ml-2 text-destructive"
                    : "ml-2 text-plum-500"
              }
            >
              {naik ? "+" : ""}
              {series.delta} dari sesi lalu
            </span>
          ) : null}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        className="h-20 w-full"
        role="img"
        aria-label={`Tren ${series.criterionName}: ${scores.join(", ")} dari ${maxScore}`}
      >
        {/* Garis bantu 0, setengah, dan nilai penuh. */}
        {[0, 0.5, 1].map((ratio) => (
          <line
            key={ratio}
            x1={0}
            x2={BOX.width}
            y1={BOX.height - ratio * BOX.height}
            y2={BOX.height - ratio * BOX.height}
            className="stroke-border"
            strokeWidth={1}
          />
        ))}

        {points ? (
          <polyline
            points={points}
            fill="none"
            className="stroke-orange-500"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {points.split(" ").map((pair, index) => {
          const [x, y] = pair.split(",");
          return (
            <circle
              key={`${pair}-${index}`}
              cx={x}
              cy={y}
              r={3}
              className="fill-orange-500"
            />
          );
        })}
      </svg>

      <p className="text-xs text-plum-500">
        Rata-rata {series.average} dari {series.points.length} penilaian
        {series.points.length > 0
          ? ` · terakhir ${formatTanggalWIB(series.points[series.points.length - 1].scheduledAt)}`
          : ""}
      </p>
    </figure>
  );
}
