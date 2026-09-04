"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/form-feedback";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  createdAtLabel: string;
  isRead: boolean;
  /** Tujuan tindak lanjut bila ada; tidak semua notifikasi punya. */
  href: string | null;
};

/**
 * Daftar notifikasi in-app (roadmap item 20, BR-09).
 *
 * Menandai dibaca dilakukan lewat API lalu router.refresh(), bukan dengan
 * menyembunyikan baris di state: jumlah belum dibaca di sidebar dirender
 * di server, dan keduanya harus berubah bersamaan.
 */
export function NotificationList({
  items,
  unreadCount,
}: {
  items: NotificationItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, key: string): Promise<void> {
    setBusy(key);
    setError(null);

    const response = await fetch(url, { method: "PATCH" });
    setBusy(null);

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Gagal memperbarui notifikasi.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <FormAlert message={error} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-plum-500">
          {unreadCount > 0
            ? `${unreadCount} belum dibaca`
            : "Semua sudah dibaca"}
        </p>
        {unreadCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void call("/api/notifications", "all")}
          >
            <CheckCheck data-icon="inline-start" />
            {busy === "all" ? "Menandai..." : "Tandai semua dibaca"}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-border px-4 py-8 text-center text-sm text-plum-500">
          Belum ada notifikasi.
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`space-y-2 rounded-md border p-4 ${
              item.isRead
                ? "border-border"
                : "border-orange-500 bg-orange-50"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-plum-800">
                  {item.title}
                </p>
                {item.body ? (
                  <p className="text-sm text-plum-700">{item.body}</p>
                ) : null}
                <p className="text-xs text-plum-500">{item.createdAtLabel}</p>
              </div>
              {item.isRead ? null : <Badge>Baru</Badge>}
            </div>

            <div className="flex flex-wrap gap-2">
              {item.href ? (
                <Button
                  variant="ghost"
                  size="xs"
                  nativeButton={false}
                  render={<Link href={item.href} />}
                >
                  Lihat detail
                </Button>
              ) : null}
              {item.isRead ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy !== null}
                  onClick={() =>
                    void call(`/api/notifications/${item.id}`, item.id)
                  }
                >
                  <Check data-icon="inline-start" />
                  {busy === item.id ? "Menandai..." : "Tandai dibaca"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
