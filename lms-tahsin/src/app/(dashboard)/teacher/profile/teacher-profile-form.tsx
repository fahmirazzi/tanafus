"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FieldError,
  FormAlert,
  FormNotice,
} from "@/components/form-feedback";

export type TeacherProfileValues = {
  bio: string;
  qualifications: string;
  sanadInfo: string;
  specialties: string;
  yearsExperience: string;
  acceptsPrivate: boolean;
  acceptingStudents: boolean;
};

export function TeacherProfileForm({
  initial,
}: {
  initial: TeacherProfileValues;
}) {
  const router = useRouter();

  const [values, setValues] = useState<TeacherProfileValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(patch: Partial<TeacherProfileValues>): void {
    setValues((prev) => ({ ...prev, ...patch }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setNotice(null);
    setBusy(true);

    const specialties = values.specialties
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const response = await fetch("/api/teachers/me/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio: values.bio,
        qualifications: values.qualifications,
        sanadInfo: values.sanadInfo,
        specialties,
        yearsExperience: values.yearsExperience,
        acceptsPrivate: values.acceptsPrivate,
        acceptingStudents: values.acceptingStudents,
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
      setFormError(body.error ?? "Gagal menyimpan profil.");
      return;
    }

    setNotice("Profil tersimpan.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor="bio">Perkenalan singkat</Label>
        <Textarea
          id="bio"
          rows={3}
          value={values.bio}
          onChange={(e) => update({ bio: e.target.value })}
          placeholder="Ditampilkan di halaman publik Anda."
          aria-invalid={Boolean(errors.bio)}
        />
        <FieldError id="bio-error" message={errors.bio} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="qualifications">Kualifikasi</Label>
        <Textarea
          id="qualifications"
          rows={3}
          value={values.qualifications}
          onChange={(e) => update({ qualifications: e.target.value })}
          placeholder="Pendidikan, sertifikasi, pengalaman mengajar."
          aria-invalid={Boolean(errors.qualifications)}
        />
        <FieldError
          id="qualifications-error"
          message={errors.qualifications}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sanadInfo">Sanad</Label>
        <Textarea
          id="sanadInfo"
          rows={3}
          value={values.sanadInfo}
          onChange={(e) => update({ sanadInfo: e.target.value })}
          placeholder="Jalur sanad bacaan, bila ada."
          aria-invalid={Boolean(errors.sanadInfo)}
        />
        <FieldError id="sanadInfo-error" message={errors.sanadInfo} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="specialties">Spesialisasi</Label>
          <Input
            id="specialties"
            value={values.specialties}
            onChange={(e) => update({ specialties: e.target.value })}
            placeholder="tahsin, tajwid, tahfizh"
            aria-invalid={Boolean(errors.specialties)}
          />
          <FieldError id="specialties-error" message={errors.specialties} />
          <p className="text-xs text-plum-500">
            Pisahkan dengan koma, maksimal 10.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="yearsExperience">Pengalaman (tahun)</Label>
          <Input
            id="yearsExperience"
            inputMode="numeric"
            value={values.yearsExperience}
            onChange={(e) => update({ yearsExperience: e.target.value })}
            aria-invalid={Boolean(errors.yearsExperience)}
          />
          <FieldError
            id="yearsExperience-error"
            message={errors.yearsExperience}
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-plum-800">
          Ketersediaan murid privat
        </legend>

        <label className="flex items-start gap-2 text-sm text-plum-700">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-plum-700"
            checked={values.acceptsPrivate}
            onChange={(e) => update({ acceptsPrivate: e.target.checked })}
          />
          <span>
            Menerima murid privat
            <span className="block text-xs text-plum-500">
              Kalau dimatikan, Anda tidak muncul sama sekali di daftar guru
              privat.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-plum-700">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-plum-700"
            checked={values.acceptingStudents}
            disabled={!values.acceptsPrivate}
            onChange={(e) => update({ acceptingStudents: e.target.checked })}
          />
          <span>
            Masih membuka kuota murid baru
            <span className="block text-xs text-plum-500">
              Kalau dimatikan, Anda tetap tampil tapi ditandai penuh, dan
              permintaan yang masuk otomatis jadi daftar tunggu.
            </span>
          </span>
        </label>
      </fieldset>

      <FormAlert message={formError} />
      <FormNotice message={notice} />

      <Button type="submit" disabled={busy}>
        {busy ? "Menyimpan..." : "Simpan profil"}
      </Button>
    </form>
  );
}
