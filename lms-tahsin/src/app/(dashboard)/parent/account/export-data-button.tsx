"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/form-feedback";

/**
 * Unduh data pribadi (NFR-6).
 *
 * Tanpa `child`: data akun yang sedang masuk (/api/account/export). Dengan
 * `child`: data anak tertaut (/api/account/family-export) — server tetap
 * memeriksa tautannya, prop ini hanya memilih endpoint.
 *
 * Memakai fetch + blob, bukan <a href> polos, supaya kegagalan bisa
 * ditampilkan sebagai pesan. Tautan biasa yang gagal hanya membuka tab kosong
 * atau mengunduh berkas berisi JSON error — pengguna tidak akan paham.
 */
export function ExportDataButton({
  child,
}: {
  child?: { id: string; fullName: string };
} = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = child
    ? `/api/account/family-export?studentId=${encodeURIComponent(child.id)}`
    : "/api/account/export";
  const fileName = child
    ? `data-tanafus-${fileSlug(child.fullName)}.json`
    : "data-tanafus.json";

  async function handleDownload(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        setError(
          res.status === 403
            ? "Anda tidak berhak mengunduh data ini."
            : "Gagal menyiapkan berkas. Coba lagi sebentar lagi.",
        );
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
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
      <Button
        type="button"
        variant={child ? "outline" : "default"}
        onClick={handleDownload}
        disabled={busy}
      >
        <Download className="size-4" />
        {busy
          ? "Menyiapkan…"
          : child
            ? `Unduh data ${child.fullName}`
            : "Unduh data saya"}
      </Button>
    </div>
  );
}

/** Nama anak → potongan nama berkas yang aman di semua sistem operasi. */
function fileSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "anak";
}
