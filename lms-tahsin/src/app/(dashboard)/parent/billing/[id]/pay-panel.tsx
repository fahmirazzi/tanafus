"use client";

import Script from "next/script";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";

/**
 * Bentuk minimal window.snap yang dipakai halaman ini. Snap dimuat dari
 * skrip pihak ketiga sehingga tidak punya tipe sendiri.
 */
type SnapCallbacks = {
  onSuccess?: () => void;
  onPending?: () => void;
  onError?: () => void;
  onClose?: () => void;
};
declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks?: SnapCallbacks) => void };
  }
}

type SnapResponse = {
  ok: boolean;
  error?: string;
  data?: { token: string };
};

/**
 * Dua jalur pembayaran satu tagihan (PRD F-5d).
 *
 * Jalur Midtrans hanya muncul bila kredensialnya terpasang di server; tanpa
 * itu, transfer manual berdiri sendiri sebagai satu-satunya cara — bukan
 * sebagai cadangan yang tampak setengah jadi.
 */
export function PayPanel({
  invoiceId,
  outstanding,
  snapEnabled,
  snapScriptSrc,
  snapClientKey,
}: {
  invoiceId: string;
  outstanding: number;
  snapEnabled: boolean;
  snapScriptSrc: string;
  snapClientKey: string;
}) {
  const router = useRouter();

  const [snapReady, setSnapReady] = useState(false);
  const [snapBusy, setSnapBusy] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);

  const [amount, setAmount] = useState(String(outstanding));
  const [proofUrl, setProofUrl] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSnap(): Promise<void> {
    setSnapError(null);
    setSnapBusy(true);

    const response = await fetch(`/api/invoices/${invoiceId}/snap`, {
      method: "POST",
    });
    const payload = (await response.json()) as SnapResponse;
    setSnapBusy(false);

    if (!response.ok || !payload.data?.token) {
      setSnapError(payload.error ?? "Gagal membuka pembayaran online.");
      return;
    }

    if (!window.snap) {
      setSnapError(
        "Skrip pembayaran belum selesai dimuat. Coba lagi sebentar lagi.",
      );
      return;
    }

    window.snap.pay(payload.data.token, {
      // Status sebenarnya datang dari webhook, bukan dari callback ini;
      // halaman cukup dimuat ulang agar menampilkan keadaan terbaru.
      onSuccess: () => router.refresh(),
      onPending: () => router.refresh(),
      onClose: () => router.refresh(),
      onError: () =>
        setSnapError("Pembayaran gagal diproses. Silakan coba lagi."),
    });
  }

  async function handleProofSubmit(
    e: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setNotice(null);
    setBusy(true);

    const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, proofUrl, reference, note }),
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
      setFormError(body.error ?? firstDetail ?? "Gagal mengirim bukti.");
      return;
    }

    setProofUrl("");
    setReference("");
    setNote("");
    setNotice(
      "Bukti transfer terkirim. Admin akan mencocokkannya dengan mutasi rekening.",
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {snapEnabled ? (
        <>
          <Script
            src={snapScriptSrc}
            data-client-key={snapClientKey}
            onReady={() => setSnapReady(true)}
          />
          <div className="space-y-3">
            <Button
              type="button"
              onClick={() => void handleSnap()}
              disabled={snapBusy || !snapReady}
            >
              <CreditCard data-icon="inline-start" />
              {snapBusy ? "Membuka..." : "Bayar online"}
            </Button>
            <p className="text-xs text-plum-500">
              Kartu, transfer virtual account, atau QRIS lewat Midtrans.
              Tagihan otomatis lunas begitu pembayaran terkonfirmasi.
            </p>
            <FormAlert message={snapError} />
          </div>

          <div className="border-t border-border pt-6">
            <p className="text-sm font-medium text-plum-800">
              Atau kirim bukti transfer manual
            </p>
          </div>
        </>
      ) : null}

      <form onSubmit={handleProofSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amount">Nominal ditransfer (Rp)</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={Boolean(errors.amount)}
              required
            />
            <FieldError id="amount-error" message={errors.amount} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Nomor rujukan (opsional)</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Nomor referensi dari aplikasi bank"
              aria-invalid={Boolean(errors.reference)}
            />
            <FieldError id="reference-error" message={errors.reference} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="proofUrl">Tautan bukti transfer</Label>
            <Input
              id="proofUrl"
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              aria-describedby="proof-help proofUrl-error"
              aria-invalid={Boolean(errors.proofUrl)}
              required
            />
            <p id="proof-help" className="text-xs text-plum-500">
              Unggah tangkapan layar ke Google Drive atau layanan sejenis,
              pastikan tautannya bisa dibuka admin, lalu tempel di sini.
            </p>
            <FieldError id="proofUrl-error" message={errors.proofUrl} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="note">Catatan (opsional)</Label>
            <Textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Misalnya: transfer atas nama ayah."
            />
            <FieldError id="note-error" message={errors.note} />
          </div>
        </div>

        <FormAlert message={formError} />
        <FormNotice message={notice} />

        <Button type="submit" variant={snapEnabled ? "outline" : "default"} disabled={busy}>
          <Upload data-icon="inline-start" />
          {busy ? "Mengirim..." : "Kirim bukti transfer"}
        </Button>
      </form>
    </div>
  );
}
