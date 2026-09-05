"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/form-feedback";

/**
 * Unduh data pribadi (NFR-6).
 *
 * Memakai fetch + blob, bukan <a href> polos, supaya kegagalan bisa
 * ditampilkan sebagai pesan. Tautan biasa yang gagal hanya membuka tab kosong
 * atau mengunduh berkas berisi JSON error — pengguna tidak akan paham.
 */
export function ExportDataButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        setError("Gagal menyiapkan berkas. Coba lagi sebentar lagi.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "data-tanafus.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Gagal menyiapkan berkas. Periksa koneksi Anda.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <FormAlert message={error} />
      <Button type="button" onClick={handleDownload} disabled={busy}>
        <Download className="size-4" />
        {busy ? "Menyiapkan…" : "Unduh data saya"}
      </Button>
    </div>
  );
}
