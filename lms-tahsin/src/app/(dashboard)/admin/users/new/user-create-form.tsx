"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleName } from "@/generated/prisma/enums";
import { FieldError, FormAlert } from "@/components/form-feedback";
import {
  ProfileFields,
  emptyProfile,
  type ProfileValues,
} from "../profile-fields";
import { RoleCheckboxes } from "../role-checkboxes";

export function UserCreateForm({ canAssignSuperAdmin }: { canAssignSuperAdmin: boolean }) {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileValues>(emptyProfile);
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleRole(role: RoleName, checked: boolean): void {
    setRoles((prev) =>
      checked ? [...prev, role] : prev.filter((r) => r !== role),
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    if (roles.length === 0) {
      setFormError("Pilih minimal satu role.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profile, password, roles }),
    });
    const payload: unknown = await response.json();
    setLoading(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      setErrors(body.details ?? {});
      setFormError(body.error ?? "Gagal menyimpan pengguna.");
      return;
    }

    const created = payload as { data?: { id?: string } };
    router.push(
      created.data?.id ? `/admin/users/${created.data.id}` : "/admin/users",
    );
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
        <Label htmlFor="password">Kata sandi awal</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          required
        />
        <FieldError id="password-error" message={errors.password} />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-plum-800">Role</legend>
        <RoleCheckboxes
          selected={roles}
          onToggle={toggleRole}
          lockedRoles={canAssignSuperAdmin ? [] : [RoleName.super_admin]}
        />
        <FieldError id="roles-error" message={errors.roles} />
      </fieldset>

      <FormAlert message={formError} />

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan pengguna"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/users")}
        >
          Batal
        </Button>
      </div>
    </form>
  );
}
