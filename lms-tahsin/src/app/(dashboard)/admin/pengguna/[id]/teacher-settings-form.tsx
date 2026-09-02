"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FieldError,
  FormAlert,
  FormNotice,
} from "@/components/form-feedback";

export function TeacherSettingsForm({
  userId,
  initialRevenueSharePct,
  acceptsPrivate,
  acceptingStudents,
  hasProfile,
}: {
  userId: string;
  initialRevenueSharePct: number;
  acceptsPrivate: boolean;
  acceptingStudents: boolean;
  hasProfile: boolean;
}) {
  const router = useRouter();

  const [value, setValue] = useState(String(initialRevenueSharePct));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setNotice(null);
    setBusy(true);

    const response = await fetch(`/api/teachers/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revenueSharePct: value }),
    });
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      setErrors(body.details ?? {});
      setFormError(body.error ?? "Gagal menyimpan bagi hasil.");
      return;
    }

    setNotice("Bagi hasil tersimpan.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-plum-500">Status privat:</span>
          <Badge variant={acceptsPrivate ? "default" : "secondary"}>
            {acceptsPrivate ? "Menerima privat" : "Tidak menerima privat"}
          </Badge>
          {acceptsPrivate ? (
            <Badge variant={acceptingStudents ? "default" : "destructive"}>
              {acceptingStudents ? "Kuota terbuka" : "Kuota penuh"}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-plum-500">
          {hasProfile
            ? "Isi profil dan ketersediaan diatur guru sendiri di halaman profilnya."
            : "Guru ini belum mengisi profil. Bagi hasil tetap bisa disetel sekarang."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 border-t border-border pt-6 md:grid-cols-[1fr_auto] md:items-end"
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="revenueSharePct">Bagi hasil guru (%)</Label>
          <Input
            id="revenueSharePct"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={Boolean(errors.revenueSharePct)}
            required
          />
          <FieldError
            id="revenueSharePct-error"
            message={errors.revenueSharePct}
          />
          <p className="text-xs text-plum-500">
            Porsi yang diterima guru dari nilai setiap sesi selesai. Default 60%.
          </p>
        </div>

        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? "Menyimpan..." : "Simpan bagi hasil"}
        </Button>
      </form>

      <FormAlert message={formError} />
      <FormNotice message={notice} />
    </div>
  );
}
