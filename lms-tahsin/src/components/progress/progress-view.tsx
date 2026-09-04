import { CriterionChart } from "@/components/progress/criterion-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTanggalWIB } from "@/lib/datetime";
import type { StudentProgress } from "@/lib/student-progress";

/**
 * Tampilan progres satu murid: grafik tren per kriteria di atas, feedback
 * terbaru di bawahnya (PRD F-4d). Dipakai bersama oleh halaman orang tua
 * dan halaman guru supaya keduanya tidak pernah bercerita berbeda.
 */
export function ProgressView({ progress }: { progress: StudentProgress }) {
  if (progress.series.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-plum-500">
          Belum ada penilaian. Grafik tren muncul setelah guru mengisi
          feedback sesi pertama.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tren nilai per kriteria
            <span className="ml-2 text-xs font-normal text-plum-500">
              {progress.sessionsGraded} sesi dinilai
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {progress.series.map((series) => (
            <CriterionChart
              key={series.criterionId}
              series={series}
              maxScore={progress.maxScoreByCriterion.get(series.criterionId) ?? 100}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catatan guru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {progress.feedbacks.length === 0 ? (
            <p className="text-sm text-plum-500">Belum ada catatan naratif.</p>
          ) : null}

          {progress.feedbacks.map((feedback) => (
            <article
              key={feedback.sessionId}
              className="space-y-3 rounded-md border border-border p-4"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-plum-800">
                  {formatTanggalWIB(feedback.scheduledAt)}
                </h3>
                <span className="text-xs text-plum-500">
                  {feedback.teacherName}
                </span>
              </header>

              {feedback.scores.length > 0 ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {feedback.scores.map((score) => (
                    <span
                      key={score.criterionName}
                      className="text-xs text-plum-700"
                    >
                      {score.criterionName}{" "}
                      <strong className="font-semibold">{score.score}</strong>
                      <span className="text-plum-500">/{score.maxScore}</span>
                    </span>
                  ))}
                </div>
              ) : null}

              <NarrativeBlock label="Kelebihan" value={feedback.strengths} />
              <NarrativeBlock
                label="Perlu diperbaiki"
                value={feedback.improvements}
              />
              <NarrativeBlock
                label="Target sesi berikutnya"
                value={feedback.nextTarget}
              />

              {feedback.audioNoteUrl ? (
                <p className="text-xs">
                  <Badge variant="secondary">Audio</Badge>{" "}
                  <a
                    href={feedback.audioNoteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-plum-700 underline underline-offset-2"
                  >
                    Dengarkan koreksi bacaan
                  </a>
                </p>
              ) : null}
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function NarrativeBlock({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-plum-500">
        {label}
      </p>
      <p className="text-sm whitespace-pre-line text-plum-700">{value}</p>
    </div>
  );
}
