"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormAlert, FormNotice } from "@/components/form-feedback";
import {
  canApplyAction,
  SESSION_ACTIONS,
  SESSION_ACTION_CONFIRM,
  SESSION_ACTION_LABEL,
  type SessionAction,
} from "@/lib/session-actions";
import { formatRupiah } from "@/lib/currency";
import { SessionStatus } from "@/generated/prisma/enums";

/**
 * Tombol aksi status sesi (PRD F-3a, roadmap item 16).
 *
 * Tiap aksi lewat dialog konfirmasi karena konsekuensinya uang: menandai
 * selesai membuat tagihan ke murid dan upah untuk guru, dan guru tidak
 * bisa menariknya kembali sendiri.
 */
export function SessionActionPanel({
  sessionId,
  status,
  notes,
}: {
  sessionId: string;
  status: SessionStatus;
  notes: string | null;
}) {
  const router = useRouter();

  const [pending, setPending] = useState<SessionAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const available = SESSION_ACTIONS.filter((action) =>
    canApplyAction(status, action),
  );

  async function submit(action: SessionAction): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/sessions/${sessionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes: draftNotes }),
    });
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
      setError(firstDetail ?? body.error ?? "Gagal memperbarui status sesi.");
      setPending(null);
      return;
    }

    const data = (payload as { data?: { earning?: { amount: number } | null } })
      .data;
    setPending(null);
    setNotice(
      data?.earning
        ? `Sesi ditandai "${SESSION_ACTION_LABEL[action]}". Upah Anda untuk sesi ini ${formatRupiah(data.earning.amount)}.`
        : `Sesi ditandai "${SESSION_ACTION_LABEL[action]}".`,
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <FormAlert message={error} />
      <FormNotice message={notice} />

      <div className="space-y-2">
        <Label htmlFor="session-notes">Catatan materi sesi</Label>
        <Textarea
          id="session-notes"
          value={draftNotes}
          rows={3}
          maxLength={1000}
          placeholder="Contoh: Al-Fatihah ayat 1-4, penekanan pada mad thabi'i."
          onChange={(e) => setDraftNotes(e.target.value)}
        />
        <p className="text-xs text-plum-500">
          Catatan ikut tersimpan saat Anda menekan salah satu tombol di bawah.
        </p>
      </div>

      {available.length === 0 ? (
        <p className="rounded-md bg-cream-100 px-3 py-2 text-sm text-plum-700">
          Status sesi ini sudah final dan tidak bisa diubah lagi.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {available.map((action) => (
            <Button
              key={action}
              type="button"
              variant={action === "cancel_teacher" ? "destructive" : "default"}
              size="sm"
              disabled={busy}
              onClick={() => setPending(action)}
            >
              {SESSION_ACTION_LABEL[action]}
            </Button>
          ))}
        </div>
      )}

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending ? SESSION_ACTION_LABEL[pending] : ""}
            </DialogTitle>
            <DialogDescription>
              {pending ? SESSION_ACTION_CONFIRM[pending] : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (pending) void submit(pending);
              }}
            >
              {busy ? "Menyimpan..." : "Ya, lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
