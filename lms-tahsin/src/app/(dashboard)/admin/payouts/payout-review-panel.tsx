"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, Wallet, X } from "lucide-react";
import { formatRupiah } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormNotice } from "@/components/form-feedback";

export type PendingEarning = {
  id: string;
  teacherName: string;
  studentName: string;
  amount: number;
  when: string;
};

export type ReviewablePayout = {
  id: string;
  teacherName: string;
  amount: number;
  sessionCount: number;
  requestedAt: string;
  /** Sudah disetujui, tinggal menunggu catatan bahwa transfernya jalan. */
  awaitingTransfer: boolean;
};

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(url, {
    method: "POST",
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
 * Antrean kerja admin atas upah guru (roadmap item 26).
 *
 * Dua antrean dipisah karena keputusannya berbeda: menyetujui upah adalah
 * pemeriksaan bahwa sesinya memang terjadi, sedangkan memproses payout
 * adalah keputusan mengeluarkan uang.
 */
export function PayoutReviewPanel({
  pendingEarnings,
  payouts,
}: {
  pendingEarnings: PendingEarning[];
  payouts: ReviewablePayout[];
}) {
  const router = useRouter();

  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedTotal = pendingEarnings
    .filter((earning) => selected.includes(earning.id))
    .reduce((sum, earning) => sum + earning.amount, 0);

  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ): Promise<void> {
    setError(null);
    setNotice(null);
    setBusy(key);
    const result = await action();
    setBusy(null);

    if (!result.ok) {
      setError(result.error ?? "Gagal.");
      return;
    }
    setNotice(successMessage);
    router.refresh();
  }

  function approveSelected(): void {
    void run(
      "approve-earnings",
      () => postJson("/api/earnings/approve", { earningIds: selected }),
      `${selected.length} upah disetujui dan siap diajukan guru.`,
    ).then(() => setSelected([]));
  }

  function review(payoutId: string, action: "approve" | "mark_paid"): void {
    void run(
      payoutId,
      () => postJson(`/api/payouts/${payoutId}/review`, { action }),
      action === "approve"
        ? "Pengajuan disetujui. Upah di dalamnya ditandai dibayar."
        : "Transfer dicatat.",
    );
  }

  function reject(e: FormEvent<HTMLFormElement>, payoutId: string): void {
    e.preventDefault();
    void run(
      payoutId,
      () =>
        postJson(`/api/payouts/${payoutId}/review`, {
          action: "reject",
          note: rejectNote,
        }),
      "Pengajuan ditolak. Upah di dalamnya kembali siap diajukan.",
    ).then(() => {
      setRejectingId(null);
      setRejectNote("");
    });
  }

  return (
    <div className="space-y-6">
      <FormAlert message={error} />
      <FormNotice message={notice} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg text-plum-800">
            Upah menunggu persetujuan ({pendingEarnings.length})
          </h2>
          {pendingEarnings.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setSelected(
                    selected.length === pendingEarnings.length
                      ? []
                      : pendingEarnings.map((earning) => earning.id),
                  )
                }
              >
                {selected.length === pendingEarnings.length
                  ? "Kosongkan pilihan"
                  : "Pilih semua"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={selected.length === 0 || busy === "approve-earnings"}
                onClick={approveSelected}
              >
                <BadgeCheck data-icon="inline-start" />
                Setujui {selected.length > 0 ? `(${selected.length})` : ""}
              </Button>
            </div>
          ) : null}
        </div>

        {selected.length > 0 ? (
          <p className="text-sm text-plum-700">
            Total dipilih: {formatRupiah(selectedTotal)}
          </p>
        ) : null}

        {pendingEarnings.length === 0 ? (
          <p className="text-sm text-plum-500">
            Tidak ada upah yang menunggu persetujuan.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {pendingEarnings.map((earning) => (
              <li key={earning.id} className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  id={`earning-${earning.id}`}
                  checked={selected.includes(earning.id)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, earning.id]
                        : prev.filter((id) => id !== earning.id),
                    )
                  }
                  className="size-4 accent-orange-500"
                />
                <Label
                  htmlFor={`earning-${earning.id}`}
                  className="flex flex-1 flex-wrap items-center justify-between gap-2 font-normal"
                >
                  <span>
                    <span className="text-sm text-plum-800">
                      {earning.teacherName}
                    </span>
                    <span className="block text-xs text-plum-500">
                      {earning.studentName} · {earning.when}
                    </span>
                  </span>
                  <span className="text-plum-800">
                    {formatRupiah(earning.amount)}
                  </span>
                </Label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg text-plum-800">
          Pengajuan pencairan ({payouts.length})
        </h2>

        {payouts.length === 0 ? (
          <p className="text-sm text-plum-500">
            Tidak ada pengajuan yang menunggu.
          </p>
        ) : (
          <ul className="space-y-3">
            {payouts.map((payout) => (
              <li
                key={payout.id}
                className="space-y-3 rounded-md border border-border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium text-plum-800">
                      {payout.teacherName} ·{" "}
                      {formatRupiah(payout.amount)}
                    </p>
                    <p className="text-xs text-plum-500">
                      {payout.sessionCount} sesi · diajukan{" "}
                      {payout.requestedAt}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {payout.awaitingTransfer
                      ? "Menunggu transfer"
                      : "Menunggu persetujuan"}
                  </Badge>
                </div>

                {payout.awaitingTransfer ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy === payout.id}
                    onClick={() => review(payout.id, "mark_paid")}
                  >
                    <Wallet data-icon="inline-start" />
                    Tandai sudah ditransfer
                  </Button>
                ) : rejectingId === payout.id ? (
                  <form
                    onSubmit={(e) => reject(e, payout.id)}
                    className="space-y-3"
                  >
                    <div className="space-y-2">
                      <Label htmlFor={`reject-${payout.id}`}>
                        Alasan penolakan
                      </Label>
                      <Textarea
                        id={`reject-${payout.id}`}
                        rows={2}
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Misalnya: ada sesi yang masih dipertanyakan orang tua."
                        required
                      />
                    </div>
                    <p className="text-xs text-plum-500">
                      Upah di dalam pengajuan ini kembali siap diajukan, tidak
                      hangus.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        variant="destructive"
                        disabled={busy === payout.id}
                      >
                        Tolak pengajuan
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
                      disabled={busy === payout.id}
                      onClick={() => review(payout.id, "approve")}
                    >
                      <Check data-icon="inline-start" />
                      Setujui
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectingId(payout.id)}
                    >
                      <X data-icon="inline-start" />
                      Tolak
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
