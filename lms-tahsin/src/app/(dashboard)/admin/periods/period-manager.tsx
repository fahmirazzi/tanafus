"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

export type PeriodRow = {
  id: string;
  name: string;
  startLabel: string;
  endLabel: string;
};

/** Daftar periode ajar + form tambah. */
export function PeriodManager({ periods }: { periods: PeriodRow[] }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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

    const response = await fetch("/api/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startDate, endDate }),
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
      setFormError(body.error ?? firstDetail ?? "Gagal membuat periode.");
      return;
    }

    setName("");
    setStartDate("");
    setEndDate("");
    setNotice(`Periode "${name}" dibuat.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {periods.length === 0 ? (
        <p className="text-sm text-plum-500">Belum ada periode.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Mulai</TableHead>
              <TableHead>Selesai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-plum-800">
                  {p.name}
                </TableCell>
                <TableCell>{p.startLabel}</TableCell>
                <TableCell>{p.endLabel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 border-t border-border pt-6 md:grid-cols-2"
        noValidate
      >
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="period-name">Nama periode</Label>
          <Input
            id="period-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Semester Ganjil 2026/2027"
            aria-invalid={Boolean(errors.name)}
            required
          />
          <FieldError id="period-name-error" message={errors.name} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="period-start">Tanggal mulai</Label>
          <Input
            id="period-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-invalid={Boolean(errors.startDate)}
            required
          />
          <FieldError id="period-start-error" message={errors.startDate} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="period-end">Tanggal selesai</Label>
          <Input
            id="period-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-invalid={Boolean(errors.endDate)}
            required
          />
          <FieldError id="period-end-error" message={errors.endDate} />
        </div>

        <FormAlert message={formError} />
        <FormNotice message={notice} />

        <Button type="submit" disabled={busy} className="md:col-span-2">
          <Plus data-icon="inline-start" />
          {busy ? "Menyimpan..." : "Tambah periode"}
        </Button>
      </form>
    </div>
  );
}
