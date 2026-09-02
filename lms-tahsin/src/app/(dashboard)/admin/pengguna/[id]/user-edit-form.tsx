"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FieldError,
  FormAlert,
  ProfileFields,
  type ProfileValues,
} from "../profile-fields";

export function UserEditForm({
  userId,
  initial,
  initialIsActive,
}: {
  userId: string;
  initial: ProfileValues;
  initialIsActive: boolean;
}) {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileValues>(initial);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setErrors({});
    setSavedAt(null);
    setLoading(true);

    const response = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profile, isActive, password }),
    });
    const payload: unknown = await response.json();
    setLoading(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      setErrors(body.details ?? {});
      setFormError(body.error ?? "Gagal menyimpan perubahan.");
      return;
    }

    setPassword("");
    setSavedAt(new Date().toLocaleTimeString("id-ID"));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <ProfileFields
        values={profile}
        errors={errors}
        onChange={(patch) => setProfile((prev) => ({ ...prev, ...patch }))}
      />

      <div className="space-y-2">
        <Label htmlFor="newPassword">Reset kata sandi</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Kosongkan bila tidak diubah"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "newPassword-error" : undefined}
        />
        <FieldError id="newPassword-error" message={errors.password} />
      </div>

      <label className="flex items-center gap-2 text-sm text-plum-700">
        <input
          type="checkbox"
          className="size-4 accent-plum-700"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Akun aktif (bisa login)
      </label>

      <FormAlert message={formError} />
      {savedAt ? (
        <p className="rounded-md bg-orange-50 px-3 py-2 text-sm text-plum-700">
          Perubahan tersimpan pukul {savedAt}.
        </p>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Menyimpan..." : "Simpan perubahan"}
      </Button>
    </form>
  );
}
