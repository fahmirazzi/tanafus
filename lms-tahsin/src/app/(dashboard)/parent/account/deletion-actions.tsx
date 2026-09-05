"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormAlert, FormNotice } from "@/components/form-feedback";

export type ChildRow = {
  id: string;
  fullName: string;
  /** null = belum ada permintaan berjalan. */
  status: string | null;
  executeAfterLabel: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  awaiting_admin: "Menunggu persetujuan admin",
  pending: "Disetujui — dalam masa tenggang",
};

/**
 * Permintaan hapus akun untuk diri sendiri dan untuk anak tertaut (NFR-6).
 *
 * Dua jalur yang sengaja berbeda: akun sendiri memakai endpoint yang tidak
 * menerima id sama sekali, sedangkan permintaan untuk anak melewati admin
 * lebih dulu. Orang tua tidak pernah bisa menganonimkan akun siapa pun secara
 * langsung — yang ia buat hanyalah antrean tinjauan.
 */
export function DeletionActions({
  ownStatus,
  ownExecuteAfterLabel,
  childRows,
}: {
  ownStatus: string | null;
  ownExecuteAfterLabel: string | null;
  childRows: ChildRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(
    key: string,
    input: RequestInfo,
    init: RequestInit,
    okMessage: string,
  ): Promise<void> {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(input, init);
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : "Permintaan gagal diproses.";
        setError(message);
        return;
      }
      setNotice(okMessage);
      router.refresh();
    } catch {
      setError("Permintaan gagal dikirim. Periksa koneksi Anda.");
    } finally {
      setBusy(null);
    }
  }

  const ownActive = ownStatus !== null;

  return (
    <div className="space-y-4">
      <FormAlert message={error} />
      <FormNotice message={notice} />

      <div className="space-y-2">
        <p className="text-sm font-medium text-plum-700">Akun saya</p>
        {ownActive ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {STATUS_LABEL[ownStatus] ?? ownStatus}
            </Badge>
            {ownExecuteAfterLabel ? (
              <span className="text-sm text-plum-600">
                Dihapus pada {ownExecuteAfterLabel}
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                void send(
                  "own-cancel",
                  "/api/account/deletion-request",
                  { method: "DELETE" },
                  "Permintaan penghapusan dibatalkan.",
                )
              }
            >
              {busy === "own-cancel" ? "Membatalkan…" : "Batalkan"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="destructive"
            disabled={busy !== null}
            onClick={() =>
              void send(
                "own",
                "/api/account/deletion-request",
                { method: "POST" },
                "Permintaan diajukan. Anda punya 7 hari untuk membatalkannya.",
              )
            }
          >
            {busy === "own" ? "Mengajukan…" : "Ajukan hapus akun saya"}
          </Button>
        )}
      </div>

      {childRows.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-plum-700">Akun anak</p>
          <p className="text-sm text-plum-600">
            Permintaan untuk akun anak ditinjau admin lebih dulu sebelum masa
            tenggang mulai berjalan.
          </p>
          <ul className="divide-y divide-border">
            {childRows.map((child) => (
              <li
                key={child.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <span className="text-sm text-plum-700">{child.fullName}</span>
                {child.status ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {STATUS_LABEL[child.status] ?? child.status}
                    </Badge>
                    {child.executeAfterLabel ? (
                      <span className="text-sm text-plum-600">
                        Dihapus pada {child.executeAfterLabel}
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() =>
                        void send(
                          `child-cancel-${child.id}`,
                          `/api/account/family-deletion-request?studentId=${child.id}`,
                          { method: "DELETE" },
                          "Permintaan dibatalkan.",
                        )
                      }
                    >
                      {busy === `child-cancel-${child.id}`
                        ? "Membatalkan…"
                        : "Batalkan"}
                    </Button>
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy !== null}
                    onClick={() =>
                      void send(
                        `child-${child.id}`,
                        "/api/account/family-deletion-request",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ studentId: child.id }),
                        },
                        "Permintaan dikirim ke admin untuk ditinjau.",
                      )
                    }
                  >
                    {busy === `child-${child.id}`
                      ? "Mengajukan…"
                      : "Ajukan hapus akun"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
