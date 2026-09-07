"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Plus } from "lucide-react";
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
import { FormAlert, FormNotice } from "@/components/form-feedback";

export type ChargeRow = {
  id: string;
  enrollmentId: string;
  studentName: string;
  installmentNo: number;
  amount: number;
  dueDate: string; // label WIB, sudah diformat server
  status: string;
  invoiced: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Belum ditagih",
  invoiced: "Sudah ditagih",
  void: "Dibatalkan",
};

type InstallmentDraft = { amount: string; dueDate: string };

/** Tagihan periode: daftar charge, "Terbitkan tagihan" bulk, dan konversi
 * cicilan per enrollment (spec B3 §3.2, §3.3). */
export function ChargeManager({
  classGroupId,
  charges,
}: {
  classGroupId: string;
  charges: ChargeRow[];
}) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Enrollment yang sedang dipilih untuk dikonversi jadi cicilan, atau null
  // kalau form konversi sedang tertutup.
  const [convertingEnrollmentId, setConvertingEnrollmentId] = useState<
    string | null
  >(null);
  const [installments, setInstallments] = useState<InstallmentDraft[]>([
    { amount: "", dueDate: "" },
    { amount: "", dueDate: "" },
  ]);

  // Kandidat konversi: enrollment dengan TEPAT SATU charge pending yang
  // belum ter-invoice — begitu sudah dipecah cicilan atau sudah ter-invoice,
  // tidak ditawarkan lagi di sini (route sendiri yang menegakkan aturan
  // sesungguhnya; ini hanya menyaring pilihan di UI).
  const convertibleEnrollmentIds = new Set(
    Object.entries(
      charges.reduce<Record<string, ChargeRow[]>>((acc, c) => {
        (acc[c.enrollmentId] ??= []).push(c);
        return acc;
      }, {}),
    )
      .filter(
        ([, rows]) =>
          rows.length === 1 && rows[0].status === "pending" && !rows[0].invoiced,
      )
      .map(([enrollmentId]) => enrollmentId),
  );

  async function handleIssueInvoices(): Promise<void> {
    setFormError(null);
    setNotice(null);
    setBusy(true);
    const response = await fetch(
      `/api/class-groups/${classGroupId}/issue-invoices`,
      { method: "POST" },
    );
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as { error?: string };
      setFormError(body.error ?? "Gagal menerbitkan tagihan.");
      return;
    }
    const body = payload as {
      data?: { invoicesCreated: number; chargesConsidered: number };
    };
    setNotice(
      `${body.data?.invoicesCreated ?? 0} dari ${body.data?.chargesConsidered ?? 0} tagihan diterbitkan.`,
    );
    router.refresh();
  }

  function updateInstallment(
    index: number,
    field: keyof InstallmentDraft,
    value: string,
  ): void {
    setInstallments((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function addInstallmentRow(): void {
    setInstallments((prev) => [...prev, { amount: "", dueDate: "" }]);
  }

  function removeInstallmentRow(index: number): void {
    setInstallments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleConvert(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    if (!convertingEnrollmentId) return;

    setBusy(true);
    const response = await fetch(
      `/api/enrollments/${convertingEnrollmentId}/installments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installments: installments.map((row) => ({
            amount: row.amount,
            dueDate: row.dueDate,
          })),
        }),
      },
    );
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as { error?: string };
      setFormError(body.error ?? "Gagal mengubah jadi cicilan.");
      return;
    }

    setNotice("Diubah jadi cicilan.");
    setConvertingEnrollmentId(null);
    setInstallments([
      { amount: "", dueDate: "" },
      { amount: "", dueDate: "" },
    ]);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {charges.length === 0 ? (
        <p className="text-sm text-plum-500">Belum ada tagihan periode.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Murid</TableHead>
              <TableHead>Cicilan</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Jatuh tempo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {charges.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-plum-800">
                  {c.studentName}
                </TableCell>
                <TableCell>{c.installmentNo}</TableCell>
                <TableCell>{c.amount.toLocaleString("id-ID")}</TableCell>
                <TableCell>{c.dueDate}</TableCell>
                <TableCell>
                  <Badge variant={c.status === "invoiced" ? "default" : "secondary"}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {convertibleEnrollmentIds.has(c.enrollmentId) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        setConvertingEnrollmentId(
                          convertingEnrollmentId === c.enrollmentId
                            ? null
                            : c.enrollmentId,
                        )
                      }
                    >
                      Ubah jadi cicilan
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {convertingEnrollmentId ? (
        <form
          onSubmit={handleConvert}
          className="space-y-4 border-t border-border pt-6"
          noValidate
        >
          <p className="text-sm text-plum-700">
            Total nominal seluruh cicilan harus sama dengan charge asli.
          </p>
          {installments.map((row, index) => (
            <div key={index} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor={`installment-amount-${index}`}>
                  Cicilan {index + 1} — Nominal (Rp)
                </Label>
                <Input
                  id={`installment-amount-${index}`}
                  inputMode="numeric"
                  value={row.amount}
                  onChange={(e) =>
                    updateInstallment(index, "amount", e.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`installment-due-${index}`}>Jatuh tempo</Label>
                <Input
                  id={`installment-due-${index}`}
                  type="date"
                  value={row.dueDate}
                  onChange={(e) =>
                    updateInstallment(index, "dueDate", e.target.value)
                  }
                  required
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={installments.length <= 1}
                onClick={() => removeInstallmentRow(index)}
              >
                Hapus
              </Button>
            </div>
          ))}

          <Button type="button" variant="ghost" size="sm" onClick={addInstallmentRow}>
            <Plus data-icon="inline-start" />
            Tambah cicilan
          </Button>

          <div className="flex gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan cicilan"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConvertingEnrollmentId(null)}
            >
              Batal
            </Button>
          </div>
        </form>
      ) : null}

      <div className="border-t border-border pt-6">
        <Button type="button" disabled={busy} onClick={() => void handleIssueInvoices()}>
          <Receipt data-icon="inline-start" />
          {busy ? "Menerbitkan..." : "Terbitkan tagihan"}
        </Button>
      </div>

      <FormAlert message={formError} />
      <FormNotice message={notice} />
    </div>
  );
}
