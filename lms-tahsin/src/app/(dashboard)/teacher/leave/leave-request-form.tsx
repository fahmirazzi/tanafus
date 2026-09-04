"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

/**
 * Pengajuan cuti guru (BR-06.2). Tersedia hanya bila guru tidak sedang
 * punya pengajuan yang masih menunggu/berjalan — dijaga oleh parent
 * lewat prop `blocked`, mencerminkan aturan yang sama di API.
 */
export function LeaveRequestForm({ blocked }: { blocked: boolean }) {
  const router = useRouter();

  const [type, setType] = useState<"short" | "long">("long");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setBusy(true);

    const response = await fetch("/api/teacher-leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, startDate, endDate, reason }),
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
      setFormError(body.error ?? firstDetail ?? "Gagal mengajukan cuti.");
      return;
    }

    setStartDate("");
    setEndDate("");
    setReason("");
    setNotice("Pengajuan cuti terkirim. Menunggu persetujuan admin.");
    router.refresh();
  }

  if (blocked) {
    return (
      <p className="text-sm text-plum-500">
        Anda masih punya pengajuan cuti yang menunggu keputusan atau sedang
        berjalan. Lihat status di bawah.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="type">Tipe cuti</Label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as "short" | "long")}
            className={selectClass}
          >
            <option value="long">Panjang (≥ 14 hari)</option>
            <option value="short">Pendek</option>
          </select>
          <p className="text-xs text-plum-500">
            Pendek cukup diliburkan per sesi lewat halaman Sesi — form ini
            hanya perlu untuk pencatatan.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">Mulai</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-invalid={Boolean(errors.startDate)}
            required
          />
          <FieldError id="startDate-error" message={errors.startDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Sampai</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-invalid={Boolean(errors.endDate)}
            required
          />
          <FieldError id="endDate-error" message={errors.endDate} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Alasan</Label>
        <Textarea
          id="reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Misalnya: cuti melahirkan."
          required
        />
        <FieldError id="reason-error" message={errors.reason} />
      </div>

      <FormAlert message={formError} />
      <FormNotice message={notice} />

      {type === "long" ? (
        <p className="text-xs text-plum-500">
          Begitu disetujui admin, jadwal rutin Anda dinonaktifkan sementara
          dan orang tua setiap murid memilih sendiri: guru pengganti atau
          jeda sampai Anda kembali.
        </p>
      ) : null}

      <Button type="submit" disabled={busy}>
        <Send data-icon="inline-start" />
        {busy ? "Mengirim..." : "Ajukan cuti"}
      </Button>
    </form>
  );
}
