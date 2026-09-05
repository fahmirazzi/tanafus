"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormAlert, FormNotice } from "@/components/form-feedback";

export type RosterRow = {
  studentId: string;
  fullName: string;
  status: string;
  enrolledAtLabel: string;
  droppedAtLabel: string | null;
};

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  completed: "Selesai",
  dropped: "Keluar",
  suspended: "Disuspend",
};

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

/** Roster murid kelas reguler (tambah/keluarkan). */
export function RosterManager({
  classGroupId,
  roster,
  availableStudents,
}: {
  classGroupId: string;
  roster: RosterRow[];
  availableStudents: { id: string; fullName: string }[];
}) {
  const router = useRouter();

  const [studentId, setStudentId] = useState(availableStudents[0]?.id ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    if (!studentId) {
      setFormError("Pilih murid lebih dulu.");
      return;
    }

    setBusy(true);
    const response = await fetch(
      `/api/class-groups/${classGroupId}/enrollments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      },
    );
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      const firstDetail = body.details
        ? Object.values(body.details)[0]
        : undefined;
      setFormError(body.error ?? firstDetail ?? "Gagal menambah murid.");
      return;
    }

    setNotice("Murid ditambahkan ke roster.");
    router.refresh();
  }

  async function handleRemove(studentIdToRemove: string): Promise<void> {
    setFormError(null);
    setNotice(null);
    setBusy(true);

    const response = await fetch(
      `/api/class-groups/${classGroupId}/enrollments/${studentIdToRemove}`,
      { method: "DELETE" },
    );
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as { error?: string };
      setFormError(body.error ?? "Gagal mengeluarkan murid.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {roster.length === 0 ? (
        <p className="text-sm text-plum-500">Belum ada murid di kelas ini.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Murid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Terdaftar</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="font-medium text-plum-800">
                  {r.fullName}
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === "active" ? "default" : "secondary"}>
                    {ENROLLMENT_STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-plum-500">
                  {r.enrolledAtLabel}
                  {r.droppedAtLabel ? ` · keluar ${r.droppedAtLabel}` : ""}
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "active" ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleRemove(r.studentId)}
                    >
                      Keluarkan
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {availableStudents.length === 0 ? (
        <p className="border-t border-border pt-6 text-sm text-plum-500">
          Semua murid yang tersedia sudah terdaftar di kelas ini.
        </p>
      ) : (
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-4 border-t border-border pt-6"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="roster-student">Tambah murid</Label>
            <select
              id="roster-student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={`${selectClass} min-w-56`}
            >
              {availableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={busy}>
            <Plus data-icon="inline-start" />
            {busy ? "Menyimpan..." : "Tambah ke roster"}
          </Button>
        </form>
      )}

      <FormAlert message={formError} />
      <FormNotice message={notice} />
    </div>
  );
}
