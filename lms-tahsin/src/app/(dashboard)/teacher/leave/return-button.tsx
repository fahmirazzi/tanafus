"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert, FormNotice } from "@/components/form-feedback";

/** Guru mengajukan "kembali aktif" dari cuti panjang (PRD F-7a). */
export function ReturnButton({
  leaveId,
  alreadyRequested,
}: {
  leaveId: string;
  alreadyRequested: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/teacher-leaves/${leaveId}/return-request`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Gagal mengajukan.");
      return;
    }
    setNotice("Pengajuan kembali aktif terkirim. Menunggu persetujuan admin.");
    router.refresh();
  }

  if (alreadyRequested) {
    return (
      <p className="text-xs text-plum-500">
        Sudah mengajukan kembali aktif, menunggu admin.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="outline" onClick={() => void submit()} disabled={busy}>
        <RotateCcw data-icon="inline-start" />
        {busy ? "Mengirim..." : "Ajukan kembali aktif"}
      </Button>
      <FormAlert message={error} />
      <FormNotice message={notice} />
    </div>
  );
}
