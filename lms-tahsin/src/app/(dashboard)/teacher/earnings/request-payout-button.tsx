"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { formatRupiah } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { FormAlert, FormNotice } from "@/components/form-feedback";

/**
 * Pengajuan pencairan upah oleh guru (BR-05.4).
 *
 * Tidak ada pemilihan sesi: pengajuan selalu mencakup seluruh upah yang
 * sudah disetujui admin, sehingga guru tidak perlu memutuskan apa pun selain
 * "sekarang atau nanti".
 */
export function RequestPayoutButton({
  claimable,
  sessionCount,
  blockedReason,
}: {
  claimable: number;
  sessionCount: number;
  blockedReason: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/payouts", { method: "POST" });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Gagal mengajukan pencairan.");
      return;
    }

    setNotice(
      "Pengajuan terkirim. Admin akan memeriksanya sebelum uang ditransfer.",
    );
    router.refresh();
  }

  if (blockedReason) {
    return <p className="text-sm text-plum-500">{blockedReason}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-plum-700">
        {sessionCount} sesi sudah disetujui admin, total{" "}
        <span className="font-medium text-plum-800">
          {formatRupiah(claimable)}
        </span>
        . Pengajuan mencakup seluruhnya.
      </p>

      <FormAlert message={error} />
      <FormNotice message={notice} />

      <Button type="button" onClick={() => void submit()} disabled={busy}>
        <Send data-icon="inline-start" />
        {busy ? "Mengirim..." : "Ajukan pencairan"}
      </Button>
    </div>
  );
}
