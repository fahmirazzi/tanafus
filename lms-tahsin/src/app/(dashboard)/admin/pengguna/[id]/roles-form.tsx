"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RoleName } from "@/generated/prisma/enums";
import { FormAlert } from "../profile-fields";
import { RoleCheckboxes } from "../role-checkboxes";

export function RolesForm({
  userId,
  initialRoles,
  canAssignSuperAdmin,
}: {
  userId: string;
  initialRoles: RoleName[];
  canAssignSuperAdmin: boolean;
}) {
  const router = useRouter();

  const [roles, setRoles] = useState<RoleName[]>(initialRoles);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleRole(role: RoleName, checked: boolean): void {
    setRoles((prev) =>
      checked ? [...prev, role] : prev.filter((r) => r !== role),
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setSavedAt(null);

    if (roles.length === 0) {
      setFormError("Pilih minimal satu role.");
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/users/${userId}/roles`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles }),
    });
    const payload: unknown = await response.json();
    setLoading(false);

    if (!response.ok) {
      const body = payload as { error?: string };
      setFormError(body.error ?? "Gagal menyimpan role.");
      return;
    }

    setSavedAt(new Date().toLocaleTimeString("id-ID"));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <RoleCheckboxes
        selected={roles}
        onToggle={toggleRole}
        lockedRoles={canAssignSuperAdmin ? [] : [RoleName.super_admin]}
      />

      <FormAlert message={formError} />
      {savedAt ? (
        <p className="rounded-md bg-orange-50 px-3 py-2 text-sm text-plum-700">
          Role tersimpan pukul {savedAt}. Perubahan berlaku setelah pengguna
          login ulang.
        </p>
      ) : null}

      <Button type="submit" variant="outline" disabled={loading}>
        {loading ? "Menyimpan..." : "Simpan role"}
      </Button>
    </form>
  );
}
