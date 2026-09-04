"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";

export type FeedbackCriterion = {
  id: number;
  name: string;
  description: string | null;
  maxScore: number;
};

export type FeedbackInitial = {
  scores: Record<number, number>;
  strengths: string;
  improvements: string;
  nextTarget: string;
  audioNoteUrl: string;
};

/**
 * Form penilaian + feedback naratif satu sesi (PRD F-4a & F-4b).
 *
 * Mengirim ulang memperbarui catatan yang sama, jadi form ini selalu
 * dimuat dengan nilai yang sudah tersimpan — guru memperbaiki, bukan
 * mengisi dari nol setiap kali.
 */
export function FeedbackForm({
  sessionId,
  criteria,
  initial,
}: {
  sessionId: string;
  criteria: FeedbackCriterion[];
  initial: FeedbackInitial;
}) {
  const router = useRouter();

  const [scores, setScores] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      criteria.map((c) => [
        c.id,
        initial.scores[c.id] !== undefined ? String(initial.scores[c.id]) : "",
      ]),
    ),
  );
  const [strengths, setStrengths] = useState(initial.strengths);
  const [improvements, setImprovements] = useState(initial.improvements);
  const [nextTarget, setNextTarget] = useState(initial.nextTarget);
  const [audioNoteUrl, setAudioNoteUrl] = useState(initial.audioNoteUrl);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setFieldErrors({});

    const grades = criteria
      .filter((c) => scores[c.id] !== "" && scores[c.id] !== undefined)
      .map((c) => ({ criterionId: c.id, score: Number(scores[c.id]) }));

    if (grades.length === 0) {
      setError("Isi nilai minimal satu kriteria.");
      return;
    }

    setBusy(true);
    const response = await fetch(`/api/sessions/${sessionId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grades,
        strengths,
        improvements,
        nextTarget,
        audioNoteUrl,
      }),
    });
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      setFieldErrors(body.details ?? {});
      const firstDetail = body.details
        ? Object.values(body.details)[0]
        : undefined;
      setError(firstDetail ?? body.error ?? "Gagal menyimpan feedback.");
      return;
    }

    setNotice("Feedback tersimpan. Murid dan orang tua sudah diberi tahu.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormAlert message={error} />
      <FormNotice message={notice} />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-plum-800">
          Rubrik penilaian
        </legend>
        {criteria.map((criterion) => (
          <div
            key={criterion.id}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <Label htmlFor={`score-${criterion.id}`}>{criterion.name}</Label>
              {criterion.description ? (
                <p className="text-xs text-plum-500">{criterion.description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Input
                id={`score-${criterion.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={criterion.maxScore}
                step={1}
                className="w-24"
                value={scores[criterion.id] ?? ""}
                onChange={(e) =>
                  setScores((prev) => ({
                    ...prev,
                    [criterion.id]: e.target.value,
                  }))
                }
              />
              <span className="text-sm text-plum-500">
                / {criterion.maxScore}
              </span>
            </div>
          </div>
        ))}
        <FieldError id="grades-error" message={fieldErrors.grades} />
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="strengths">Kelebihan</Label>
        <Textarea
          id="strengths"
          rows={2}
          maxLength={2000}
          value={strengths}
          onChange={(e) => setStrengths(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="improvements">Yang perlu diperbaiki</Label>
        <Textarea
          id="improvements"
          rows={2}
          maxLength={2000}
          value={improvements}
          onChange={(e) => setImprovements(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nextTarget">Target sesi berikutnya</Label>
        <Textarea
          id="nextTarget"
          rows={2}
          maxLength={2000}
          value={nextTarget}
          onChange={(e) => setNextTarget(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="audioNoteUrl">Tautan audio koreksi</Label>
        <Input
          id="audioNoteUrl"
          type="url"
          placeholder="https://..."
          value={audioNoteUrl}
          onChange={(e) => setAudioNoteUrl(e.target.value)}
          aria-describedby="audio-help audioNoteUrl-error"
        />
        <p id="audio-help" className="text-xs text-plum-500">
          Rekam koreksi bacaan di ponsel, unggah ke penyimpanan Anda, lalu
          tempel tautannya di sini.
        </p>
        <FieldError
          id="audioNoteUrl-error"
          message={fieldErrors.audioNoteUrl}
        />
      </div>

      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Menyimpan..." : "Simpan feedback"}
      </Button>
    </form>
  );
}
