"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Relation } from "@/generated/prisma/enums";
import { RELATION_LABEL } from "@/lib/labels";
import { FormAlert } from "../profile-fields";

export type LinkedChild = {
  id: string;
  fullName: string;
  isActive: boolean;
  relation: Relation;
  isPrimary: boolean;
};

type StudentOption = { id: string; fullName: string; email: string | null };

export function ChildrenManager({
  parentId,
  linkedChildren,
}: {
  parentId: string;
  linkedChildren: LinkedChild[];
}) {
  const router = useRouter();

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<StudentOption[] | null>(null);
  const [picked, setPicked] = useState<StudentOption | null>(null);
  const [relation, setRelation] = useState<string>("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSearch(): Promise<void> {
    setFormError(null);
    setBusy(true);
    const params = new URLSearchParams({
      role: "student",
      pageSize: "10",
      ...(term.trim() ? { q: term.trim() } : {}),
    });
    const response = await fetch(`/api/users?${params.toString()}`);
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      setFormError("Gagal mencari murid.");
      return;
    }
    const body = payload as { data?: StudentOption[] };
    // Murid yang sudah terhubung tidak perlu muncul lagi di hasil pencarian.
    const linked = new Set(linkedChildren.map((c) => c.id));
    setResults((body.data ?? []).filter((s) => !linked.has(s.id)));
  }

  async function handleLink(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormError(null);

    if (!picked) {
      setFormError("Pilih murid lebih dulu.");
      return;
    }
    if (!relation) {
      setFormError("Pilih hubungan dengan murid.");
      return;
    }

    setBusy(true);
    const response = await fetch(`/api/users/${parentId}/children`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: picked.id, relation, isPrimary }),
    });
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      setFormError(
        body.details?.studentId ?? body.error ?? "Gagal menghubungkan murid.",
      );
      return;
    }

    setPicked(null);
    setResults(null);
    setTerm("");
    setRelation("");
    setIsPrimary(false);
    router.refresh();
  }

  async function handleUnlink(studentId: string): Promise<void> {
    setFormError(null);
    setBusy(true);
    const response = await fetch(
      `/api/users/${parentId}/children/${studentId}`,
      { method: "DELETE" },
    );
    setBusy(false);

    if (!response.ok) {
      setFormError("Gagal memutus hubungan.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {linkedChildren.length === 0 ? (
        <p className="text-sm text-plum-500">Belum ada murid yang terhubung.</p>
      ) : (
        <ul className="divide-y divide-border">
          {linkedChildren.map((child) => (
            <li
              key={child.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-plum-800">
                    {child.fullName}
                  </span>
                  {child.isPrimary ? <Badge>Wali utama</Badge> : null}
                  {child.isActive ? null : (
                    <Badge variant="destructive">Nonaktif</Badge>
                  )}
                </div>
                <p className="text-xs text-plum-500">
                  {RELATION_LABEL[child.relation]}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => void handleUnlink(child.id)}
              >
                <Trash2 data-icon="inline-start" />
                Putuskan
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleLink} className="space-y-4 border-t border-border pt-6">
        <p className="text-sm font-semibold text-plum-800">Hubungkan murid</p>

        <div className="flex gap-2">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Cari nama murid"
            aria-label="Cari murid"
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void handleSearch()}
          >
            <Search data-icon="inline-start" />
            Cari
          </Button>
        </div>

        {results !== null ? (
          results.length === 0 ? (
            <p className="text-sm text-plum-500">
              Tidak ada murid yang cocok. Buat akun murid lebih dulu bila belum
              ada.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {results.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div>
                    <div className="text-sm text-plum-800">
                      {student.fullName}
                    </div>
                    <div className="text-xs text-plum-500">
                      {student.email ?? "tanpa email"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={picked?.id === student.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPicked(student)}
                  >
                    {picked?.id === student.id ? "Dipilih" : "Pilih"}
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {picked ? (
          <p className="text-sm text-plum-700">
            Murid dipilih: <strong>{picked.fullName}</strong>
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 md:items-end">
          <div className="space-y-2">
            <Label htmlFor="relation">Hubungan</Label>
            <Select
              value={relation}
              onValueChange={(value) => setRelation(value ?? "")}
            >
              <SelectTrigger id="relation" className="w-full">
                <SelectValue placeholder="Pilih hubungan">
                  {(value: string | null) =>
                    value ? RELATION_LABEL[value as Relation] : "Pilih hubungan"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.values(Relation).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RELATION_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 pb-2 text-sm text-plum-700">
            <input
              type="checkbox"
              className="size-4 accent-plum-700"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            Jadikan wali utama
          </label>
        </div>

        <FormAlert message={formError} />

        <Button type="submit" disabled={busy || !picked}>
          {busy ? "Memproses..." : "Hubungkan"}
        </Button>
      </form>
    </div>
  );
}
