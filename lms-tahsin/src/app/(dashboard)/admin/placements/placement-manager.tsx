"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

export type PlacementRow = {
  id: string;
  studentName: string;
  quizScore: number | null;
  verdict: string;
  recommendedCourseName: string | null;
  status: string;
  createdAtLabel: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  reviewed: "Ditinjau",
  placed: "Ditempatkan",
};

/** Daftar placement + form catat baru + ubah status per baris (spec B2 §3.4). */
export function PlacementManager({
  placements,
  students,
  courses,
}: {
  placements: PlacementRow[];
  students: { id: string; fullName: string }[];
  courses: { id: string; name: string }[];
}) {
  const router = useRouter();

  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [quizScore, setQuizScore] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [verdict, setVerdict] = useState("");
  const [recommendedCourseId, setRecommendedCourseId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setNotice(null);

    if (!studentId) {
      setFormError("Pilih murid lebih dulu.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/placements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        quizScore: quizScore || undefined,
        interviewNotes,
        audioUrl,
        verdict,
        recommendedCourseId: recommendedCourseId || undefined,
      }),
    });
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      setErrors(body.details ?? {});
      const firstDetail = body.details
        ? Object.values(body.details)[0]
        : undefined;
      setFormError(body.error ?? firstDetail ?? "Gagal menyimpan placement.");
      return;
    }

    setQuizScore("");
    setInterviewNotes("");
    setAudioUrl("");
    setVerdict("");
    setRecommendedCourseId("");
    setNotice("Placement dicatat.");
    router.refresh();
  }

  async function handleStatusChange(id: string, status: string): Promise<void> {
    setBusy(true);
    const response = await fetch(`/api/placements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      {placements.length === 0 ? (
        <p className="text-sm text-plum-500">Belum ada catatan placement.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Murid</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead>Rekomendasi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dicatat</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {placements.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-plum-800">
                  {p.studentName}
                </TableCell>
                <TableCell>{p.verdict}</TableCell>
                <TableCell>{p.recommendedCourseName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "placed" ? "default" : "secondary"}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-plum-500">
                  {p.createdAtLabel}
                </TableCell>
                <TableCell className="text-right">
                  {p.status !== "placed" ? (
                    <select
                      aria-label={`Ubah status placement ${p.studentName}`}
                      defaultValue=""
                      disabled={busy}
                      onChange={(e) => {
                        if (e.target.value) void handleStatusChange(p.id, e.target.value);
                      }}
                      className={`${selectClass} w-40`}
                    >
                      <option value="" disabled>
                        Ubah status...
                      </option>
                      {p.status === "draft" ? (
                        <option value="reviewed">Tandai ditinjau</option>
                      ) : null}
                      <option value="placed">Tandai ditempatkan</option>
                    </select>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {students.length === 0 ? (
        <p className="border-t border-border pt-6 text-sm text-plum-500">
          Belum ada akun murid untuk dicatat placement-nya.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 border-t border-border pt-6 md:grid-cols-2"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="placement-student">Murid</Label>
            <select
              id="placement-student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={selectClass}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <FieldError id="placement-student-error" message={errors.studentId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="placement-quiz">Skor kuis (opsional)</Label>
            <Input
              id="placement-quiz"
              inputMode="numeric"
              value={quizScore}
              onChange={(e) => setQuizScore(e.target.value)}
              aria-invalid={Boolean(errors.quizScore)}
            />
            <FieldError id="placement-quiz-error" message={errors.quizScore} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="placement-notes">Catatan wawancara (opsional)</Label>
            <Input
              id="placement-notes"
              value={interviewNotes}
              onChange={(e) => setInterviewNotes(e.target.value)}
              aria-invalid={Boolean(errors.interviewNotes)}
            />
            <FieldError id="placement-notes-error" message={errors.interviewNotes} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="placement-audio">Tautan rekaman audio (opsional)</Label>
            <Input
              id="placement-audio"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://..."
              aria-invalid={Boolean(errors.audioUrl)}
            />
            <FieldError id="placement-audio-error" message={errors.audioUrl} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="placement-verdict">Verdict (kesimpulan level)</Label>
            <Input
              id="placement-verdict"
              value={verdict}
              onChange={(e) => setVerdict(e.target.value)}
              placeholder="Tahsin Lanjutan"
              aria-invalid={Boolean(errors.verdict)}
              required
            />
            <FieldError id="placement-verdict-error" message={errors.verdict} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="placement-course">Course yang direkomendasikan (opsional)</Label>
            <select
              id="placement-course"
              value={recommendedCourseId}
              onChange={(e) => setRecommendedCourseId(e.target.value)}
              className={selectClass}
            >
              <option value="">— Tidak ada —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError
              id="placement-course-error"
              message={errors.recommendedCourseId}
            />
          </div>

          <FormAlert message={formError} />
          <FormNotice message={notice} />

          <Button type="submit" disabled={busy} className="md:col-span-2">
            <Plus data-icon="inline-start" />
            {busy ? "Menyimpan..." : "Catat placement"}
          </Button>
        </form>
      )}
    </div>
  );
}
