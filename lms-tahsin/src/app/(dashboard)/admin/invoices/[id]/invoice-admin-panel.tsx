"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, ExternalLink, RotateCcw, X } from "lucide-react";
import { formatRupiah } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormNotice } from "@/components/form-feedback";

export type PendingProof = {
  id: string;
  amount: number;
  reference: string | null;
  proofUrl: string | null;
  note: string | null;
  submittedAt: string;
};

async function postJson(
  url: string,
  body: unknown,
  method: "POST" | "DELETE" = "POST",
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    error?: string;
    details?: Record<string, string>;
  };
  if (response.ok) return { ok: true };

  const firstDetail = payload.details
    ? Object.values(payload.details)[0]
    : undefined;
  return { ok: false, error: payload.error ?? firstDetail ?? "Gagal." };
}

/**
 * Aksi admin atas satu tagihan: verifikasi bukti transfer, pembatalan
 * tagihan, dan pencabutan suspensi murid.
 *
 * Ketiganya menyentuh uang atau akses murid, jadi masing-masing meminta
 * konfirmasi terpisah dan penolakan selalu menuntut alasan tertulis.
 */
export function InvoiceAdminPanel({
  invoiceId,
  studentId,
  studentName,
  canVoid,
  suspended,
  proofs,
}: {
  invoiceId: string;
  studentId: string;
  studentName: string;
  canVoid: boolean;
  suspended: boolean;
  proofs: PendingProof[];
}) {
  const router = useRouter();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [voidOpen, setVoidOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ): Promise<void> {
    setError(null);
    setNotice(null);
    setBusyId(key);
    const result = await action();
    setBusyId(null);

    if (!result.ok) {
      setError(result.error ?? "Gagal.");
      return;
    }
    setNotice(successMessage);
    router.refresh();
  }

  function verify(paymentId: string): void {
    void run(
      paymentId,
      () =>
        postJson(`/api/payments/${paymentId}/verify`, { action: "verify" }),
      "Pembayaran diverifikasi.",
    );
  }

  function reject(e: FormEvent<HTMLFormElement>, paymentId: string): void {
    e.preventDefault();
    void run(
      paymentId,
      () =>
        postJson(`/api/payments/${paymentId}/verify`, {
          action: "reject",
          note: rejectNote,
        }),
      "Bukti transfer ditolak.",
    ).then(() => {
      setRejectingId(null);
      setRejectNote("");
    });
  }

  function voidInvoice(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    void run(
      "void",
      () => postJson(`/api/invoices/${invoiceId}/void`, { reason: voidReason }),
      "Tagihan dibatalkan. Sesi di dalamnya bisa ditagih ulang.",
    ).then(() => {
      setVoidOpen(false);
      setVoidReason("");
    });
  }

  function unsuspend(): void {
    void run(
      "unsuspend",
      () => postJson(`/api/students/${studentId}/suspension`, {}, "DELETE"),
      `${studentName} bisa dijadwalkan sesi lagi.`,
    );
  }

  return (
    <div className="space-y-6">
      {proofs.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-plum-800">
            Bukti transfer menunggu verifikasi
          </p>
          {proofs.map((proof) => (
            <div
              key={proof.id}
              className="space-y-3 rounded-md border border-border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-plum-800">
                    {formatRupiah(proof.amount)}
                  </p>
                  <p className="text-xs text-plum-500">
                    Dikirim {proof.submittedAt}
                    {proof.reference ? ` · rujukan ${proof.reference}` : ""}
                  </p>
                  {proof.note ? (
                    <p className="text-sm text-plum-700">{proof.note}</p>
                  ) : null}
                </div>
                <Badge variant="secondary">Menunggu verifikasi</Badge>
              </div>

              {proof.proofUrl ? (
                <a
                  href={proof.proofUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm text-plum-700 underline underline-offset-4"
                >
                  Buka bukti transfer
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}

              <p className="text-xs text-plum-500">
                Cocokkan nominal dan waktu dengan mutasi rekening lembaga
                sebelum memverifikasi.
              </p>

              {rejectingId === proof.id ? (
                <form
                  onSubmit={(e) => reject(e, proof.id)}
                  className="space-y-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`reject-${proof.id}`}>
                      Alasan penolakan
                    </Label>
                    <Textarea
                      id={`reject-${proof.id}`}
                      rows={2}
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Misalnya: nominal tidak cocok dengan mutasi."
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      variant="destructive"
                      disabled={busyId === proof.id}
                    >
                      Tolak bukti ini
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setRejectingId(null)}
                    >
                      Batal
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => verify(proof.id)}
                    disabled={busyId === proof.id}
                  >
                    <Check data-icon="inline-start" />
                    Verifikasi
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRejectingId(proof.id)}
                  >
                    <X data-icon="inline-start" />
                    Tolak
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {suspended ? (
        <div className="space-y-2 rounded-md border border-border p-4">
          <p className="text-sm text-plum-700">
            {studentName} sedang disuspend dan tidak bisa dijadwalkan sesi
            baru. Sesi yang sudah ada tetap berjalan.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={unsuspend}
            disabled={busyId === "unsuspend"}
          >
            <RotateCcw data-icon="inline-start" />
            Cabut suspensi
          </Button>
        </div>
      ) : null}

      {canVoid ? (
        voidOpen ? (
          <form
            onSubmit={voidInvoice}
            className="space-y-3 rounded-md border border-border p-4"
          >
            <div className="space-y-2">
              <Label htmlFor="voidReason">Alasan pembatalan</Label>
              <Textarea
                id="voidReason"
                rows={2}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Misalnya: sesi tercatat ganda."
                required
              />
            </div>
            <p className="text-xs text-plum-500">
              Tagihan tidak dihapus, hanya ditandai batal. Sesi di dalamnya
              kembali menunggu tagihan dan akan masuk invoice berikutnya.
            </p>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                disabled={busyId === "void"}
              >
                Batalkan tagihan
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setVoidOpen(false)}
              >
                Batal
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setVoidOpen(true)}
          >
            <Ban data-icon="inline-start" />
            Batalkan tagihan
          </Button>
        )
      ) : null}

      <FormAlert message={error} />
      <FormNotice message={notice} />
    </div>
  );
}
