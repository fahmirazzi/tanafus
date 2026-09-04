"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FieldError, FormAlert } from "@/components/form-feedback";

export type Tier = {
  id: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
};

export function TierManager({ tiers }: { tiers: Tier[] }) {
  const router = useRouter();

  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(tiers.map((t) => [t.id, String(t.price)])),
  );
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(
    url: string,
    method: string,
    body?: unknown,
  ): Promise<{ ok: boolean; error?: string; details?: Record<string, string> }> {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload: unknown = await response.json();
    if (response.ok) return { ok: true };
    const parsed = payload as {
      error?: string;
      details?: Record<string, string>;
    };
    return { ok: false, error: parsed.error, details: parsed.details };
  }

  async function handleAdd(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setBusy(true);

    const result = await send("/api/pricing-tiers", "POST", {
      durationMinutes: duration,
      price,
    });
    setBusy(false);

    if (!result.ok) {
      setErrors(result.details ?? {});
      setFormError(result.error ?? "Gagal menambah tarif.");
      return;
    }

    setDuration("");
    setPrice("");
    router.refresh();
  }

  async function handleSavePrice(tier: Tier): Promise<void> {
    setErrors({});
    setFormError(null);
    setBusy(true);

    const result = await send(`/api/pricing-tiers/${tier.id}`, "PATCH", {
      price: drafts[tier.id] ?? String(tier.price),
    });
    setBusy(false);

    if (!result.ok) {
      setFormError(
        result.details?.price ?? result.error ?? "Gagal menyimpan harga.",
      );
      return;
    }
    router.refresh();
  }

  async function handleToggle(tier: Tier): Promise<void> {
    setFormError(null);
    setBusy(true);

    const result = tier.isActive
      ? await send(`/api/pricing-tiers/${tier.id}`, "DELETE")
      : await send(`/api/pricing-tiers/${tier.id}`, "PATCH", { isActive: true });
    setBusy(false);

    if (!result.ok) {
      setFormError(result.error ?? "Gagal mengubah status tarif.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {tiers.length === 0 ? (
        <p className="text-sm text-plum-500">
          Belum ada tarif. Tambahkan minimal satu durasi agar sesi privat bisa
          ditagih.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Durasi</TableHead>
              <TableHead>Harga (Rp)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((tier) => (
              <TableRow key={tier.id}>
                <TableCell className="font-medium text-plum-800">
                  {tier.durationMinutes} menit
                </TableCell>
                <TableCell>
                  <Input
                    inputMode="numeric"
                    aria-label={`Harga ${tier.durationMinutes} menit`}
                    value={drafts[tier.id] ?? String(tier.price)}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [tier.id]: e.target.value,
                      }))
                    }
                    className="max-w-40"
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={tier.isActive ? "default" : "destructive"}>
                    {tier.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleSavePrice(tier)}
                    >
                      Simpan
                    </Button>
                    <Button
                      type="button"
                      variant={tier.isActive ? "destructive" : "secondary"}
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleToggle(tier)}
                    >
                      {tier.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <form
        onSubmit={handleAdd}
        className="grid gap-4 border-t border-border pt-6 md:grid-cols-[1fr_1fr_auto] md:items-end"
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="durationMinutes">Durasi baru (menit)</Label>
          <Input
            id="durationMinutes"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            aria-invalid={Boolean(errors.durationMinutes)}
            required
          />
          <FieldError
            id="durationMinutes-error"
            message={errors.durationMinutes}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPrice">Harga (Rp)</Label>
          <Input
            id="newPrice"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={Boolean(errors.price)}
            required
          />
          <FieldError id="newPrice-error" message={errors.price} />
        </div>

        <Button type="submit" disabled={busy}>
          <Plus data-icon="inline-start" />
          Tambah tarif
        </Button>
      </form>

      <FormAlert message={formError} />

      <p className="text-xs text-plum-500">
        Durasi tidak bisa diubah karena dipakai sebagai kunci tarif khusus
        murid. Untuk mengganti durasi, nonaktifkan tarif lama lalu buat yang
        baru. Perubahan harga tidak berlaku surut — sesi yang sudah selesai
        memakai harga saat itu.
      </p>
    </div>
  );
}
