"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormAlert, FormNotice } from "@/components/form-feedback";

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

export type TeacherOption = { id: string; fullName: string };

/**
 * Pilihan satu keluarga atas cuti panjang guru anaknya (BR-06.3): guru
 * pengganti sementara, atau jeda jadwal sampai guru kembali.
 */
export function CoverageChoiceForm({
  coverageId,
  studentName,
  teachers,
}: {
  coverageId: string;
  studentName: string;
  teachers: TeacherOption[];
}) {
  const router = useRouter();

  const [choice, setChoice] = useState<"substitute" | "pause">("substitute");
  const [substituteTeacherId, setSubstituteTeacherId] = useState(
    teachers[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const response = await fetch(`/api/teacher-leave-coverages/${coverageId}/choice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        choice,
        ...(choice === "substitute" ? { substituteTeacherId } : {}),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Gagal mengirim pilihan.");
      return;
    }
    setNotice("Pilihan tersimpan.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor={`choice-${coverageId}`}>Pilihan untuk {studentName}</Label>
          <select
            id={`choice-${coverageId}`}
            value={choice}
            onChange={(e) => setChoice(e.target.value as "substitute" | "pause")}
            className={selectClass}
          >
            <option value="substitute">Guru pengganti sementara</option>
            <option value="pause">Jeda sampai guru kembali</option>
          </select>
        </div>

        {choice === "substitute" ? (
          <div className="space-y-2">
            <Label htmlFor={`substitute-${coverageId}`}>Guru pengganti</Label>
            {teachers.length === 0 ? (
              <p className="text-xs text-destructive">
                Tidak ada guru privat lain yang tersedia saat ini.
              </p>
            ) : (
              <select
                id={`substitute-${coverageId}`}
                value={substituteTeacherId}
                onChange={(e) => setSubstituteTeacherId(e.target.value)}
                className={selectClass}
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div />
        )}

        <Button
          type="submit"
          size="sm"
          disabled={busy || (choice === "substitute" && teachers.length === 0)}
        >
          {busy ? "Menyimpan..." : "Kirim pilihan"}
        </Button>
      </div>

      <FormAlert message={error} />
      <FormNotice message={notice} />
    </form>
  );
}
