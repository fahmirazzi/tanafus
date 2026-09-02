"use client";

import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupiah } from "@/lib/currency";
import { FormAlert } from "../pengguna/profile-fields";
import type { Tier } from "./tier-manager";

type StudentOption = { id: string; fullName: string; email: string | null };

export function CustomRateManager({ tiers }: { tiers: Tier[] }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<StudentOption[] | null>(null);
  const [picked, setPicked] = useState<StudentOption | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [hasExisting, setHasExisting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSearch(): Promise<void> {
    setFormError(null);
    setNotice(null);
    setBusy(true);

    const params = new URLSearchParams({
      role: "student",
      pageSize: "10",
      ...(term.trim() ? { q: term.trim() } : {}),
    });
    const response = await fetch(`/api/users?${params.toString()}`);
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      setFormError("Gagal mencari murid.");
      return;
    }
    setResults((payload as { data?: StudentOption[] }).data ?? []);
  }

  async function handlePick(student: StudentOption): Promise<void> {
    setFormError(null);
    setNotice(null);
    setPicked(student);
    setBusy(true);

    const response = await fetch(`/api/students/${student.id}/custom-rate`);
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      setFormError("Gagal memuat tarif khusus murid.");
      return;
    }

    const current = (payload as { data?: { customPrice?: unknown } }).data
      ?.customPrice;
    if (current && typeof current === "object") {
      const record = current as Record<string, unknown>;
      setAmounts(
        Object.fromEntries(
          Object.entries(record).map(([k, v]) => [k, String(v)]),
        ),
      );
      setHasExisting(true);
    } else {
      setAmounts({});
      setHasExisting(false);
    }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    if (!picked) {
      setFormError("Pilih murid lebih dulu.");
      return;
    }

    // Kolom kosong berarti durasi itu memakai tarif standar, bukan gratis.
    const customPrice: Record<string, number> = {};
    for (const [duration, raw] of Object.entries(amounts)) {
      if (raw.trim() === "") continue;
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 0) {
        setFormError(`Harga untuk ${duration} menit harus bilangan bulat.`);
        return;
      }
      customPrice[duration] = value;
    }

    if (Object.keys(customPrice).length === 0) {
      setFormError(
        "Isi minimal satu durasi, atau tekan Hapus untuk mengembalikan ke tarif standar.",
      );
      return;
    }

    setBusy(true);
    const response = await fetch(`/api/students/${picked.id}/custom-rate`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customPrice }),
    });
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      // Zod memberi kunci bersarang (mis. "customPrice.30"), jadi ambil
      // pesan pertama apa pun kuncinya sebelum jatuh ke pesan umum.
      const firstDetail = body.details
        ? Object.values(body.details)[0]
        : undefined;
      setFormError(
        body.details?.customPrice ??
          firstDetail ??
          body.error ??
          "Gagal menyimpan tarif khusus.",
      );
      return;
    }

    setHasExisting(true);
    setNotice(`Tarif khusus ${picked.fullName} tersimpan.`);
  }

  async function handleDelete(): Promise<void> {
    if (!picked) return;
    setFormError(null);
    setNotice(null);
    setBusy(true);

    const response = await fetch(`/api/students/${picked.id}/custom-rate`, {
      method: "DELETE",
    });
    setBusy(false);

    if (!response.ok) {
      setFormError("Gagal menghapus tarif khusus.");
      return;
    }

    setAmounts({});
    setHasExisting(false);
    setNotice(`${picked.fullName} kembali memakai tarif standar.`);
  }

  const activeTiers = tiers.filter((t) => t.isActive);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Cari nama murid"
          aria-label="Cari murid"
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void handleSearch()}
        >
          <Search data-icon="inline-start" />
          Cari
        </Button>
      </div>

      {results !== null && results.length === 0 ? (
        <p className="text-sm text-plum-500">Tidak ada murid yang cocok.</p>
      ) : null}

      {results !== null && results.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {results.map((student) => (
            <li
              key={student.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div>
                <div className="text-sm text-plum-800">{student.fullName}</div>
                <div className="text-xs text-plum-500">
                  {student.email ?? "tanpa email"}
                </div>
              </div>
              <Button
                type="button"
                variant={picked?.id === student.id ? "default" : "ghost"}
                size="sm"
                disabled={busy}
                onClick={() => void handlePick(student)}
              >
                {picked?.id === student.id ? "Dipilih" : "Pilih"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {picked ? (
        <form
          onSubmit={handleSave}
          className="space-y-4 border-t border-border pt-6"
          noValidate
        >
          <p className="text-sm text-plum-700">
            Tarif khusus untuk <strong>{picked.fullName}</strong>
            {hasExisting ? " (sudah punya override)" : " (belum ada override)"}
          </p>

          {activeTiers.length === 0 ? (
            <p className="text-sm text-plum-500">
              Belum ada tarif aktif. Tambahkan tarif standar lebih dulu.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {activeTiers.map((tier) => (
                <div key={tier.id} className="space-y-2">
                  <Label htmlFor={`rate-${tier.id}`}>
                    {tier.durationMinutes} menit
                  </Label>
                  <Input
                    id={`rate-${tier.id}`}
                    inputMode="numeric"
                    value={amounts[String(tier.durationMinutes)] ?? ""}
                    onChange={(e) =>
                      setAmounts((prev) => ({
                        ...prev,
                        [String(tier.durationMinutes)]: e.target.value,
                      }))
                    }
                    placeholder={String(tier.price)}
                  />
                  <p className="text-xs text-plum-500">
                    Standar {formatRupiah(tier.price)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <FormAlert message={formError} />
          {notice ? (
            <p className="rounded-md bg-orange-50 px-3 py-2 text-sm text-plum-700">
              {notice}
            </p>
          ) : null}

          <div className="flex gap-3">
            <Button type="submit" disabled={busy || activeTiers.length === 0}>
              {busy ? "Menyimpan..." : "Simpan tarif khusus"}
            </Button>
            {hasExisting ? (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void handleDelete()}
              >
                Hapus tarif khusus
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-plum-500">
            Kolom yang dikosongkan berarti durasi tersebut memakai tarif
            standar. Isi 0 hanya bila memang digratiskan.
          </p>
        </form>
      ) : null}

      {picked === null ? <FormAlert message={formError} /> : null}
    </div>
  );
}
