"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";

export type DeletionRow = {
  id: string;
  accountName: string;
  accountEmail: string | null;
  requestedByLabel: string;
  requestedAtLabel: string;
  executeAfterLabel: string | null;
  status: string;
  statusLabel: string;
  blockedReason: string | null;
};

/**
 * Daftar tinjauan permintaan hapus akun.
 *
 * Menolak WAJIB disertai alasan — keluarga berhak tahu kenapa permintaan
 * penghapusan datanya tidak dijalankan, dan alasan itu tersimpan di
 * blockedReason sebagai jejak.
 */
export function DeletionReviewList({
  rows,
  readOnly = false,
}: {
  rows: DeletionRow[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  async function review(
    id: string,
    decision: "approve" | "reject",
  ): Promise<void> {
    const reason = reasons[id]?.trim() ?? "";
    if (decision === "reject" && !reason) {
      setFieldError({ [id]: "Alasan penolakan wajib diisi" });
      return;
    }

    setBusy(`${id}-${decision}`);
    setError(null);
    setNotice(null);
    setFieldError({});
    try {
      const res = await fetch(`/api/deletion-requests/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : "Gagal memproses tinjauan.";
        setError(message);
        return;
      }
      setNotice(
        decision === "approve"
          ? "Disetujui. Masa tenggang 7 hari dimulai sekarang."
          : "Permintaan ditolak.",
      );
      router.refresh();
    } catch {
      setError("Gagal mengirim tinjauan. Periksa koneksi Anda.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <FormAlert message={error} />
      <FormNotice message={notice} />

      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id} className="space-y-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-plum-800">
                  {row.accountName}
                </p>
                <p className="text-sm text-plum-600">
                  {row.accountEmail ?? "tanpa email"} · diajukan oleh{" "}
                  {row.requestedByLabel} · {row.requestedAtLabel}
                </p>
              </div>
              <Badge variant="secondary">{row.statusLabel}</Badge>
            </div>

            {row.executeAfterLabel ? (
              <p className="text-sm text-plum-600">
                Dihapus pada {row.executeAfterLabel}
              </p>
            ) : null}
            {row.blockedReason ? (
              <p className="text-sm text-plum-600">
                Alasan: {row.blockedReason}
              </p>
            ) : null}

            {readOnly ? null : (
              <div className="space-y-2">
                <Label htmlFor={`reason-${row.id}`}>
                  Alasan (wajib bila menolak)
                </Label>
                <Textarea
                  id={`reason-${row.id}`}
                  value={reasons[row.id] ?? ""}
                  onChange={(e) =>
                    setReasons((prev) => ({ ...prev, [row.id]: e.target.value }))
                  }
                  rows={2}
                />
                <FieldError
                  id={`reason-error-${row.id}`}
                  message={fieldError[row.id]}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void review(row.id, "approve")}
                  >
                    {busy === `${row.id}-approve` ? "Memproses…" : "Setujui"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void review(row.id, "reject")}
                  >
                    {busy === `${row.id}-reject` ? "Memproses…" : "Tolak"}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
