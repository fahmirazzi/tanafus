"use client";

import { useSyncExternalStore } from "react";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";

/** PRD F-3c: tombol gabung baru aktif 15 menit sebelum sesi mulai. */
const OPEN_BEFORE_MS = 15 * 60_000;

/** Cukup sering untuk membuka tombol tepat waktu, cukup jarang untuk diabaikan. */
const TICK_MS = 30_000;

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, TICK_MS);
  return () => clearInterval(timer);
}

/**
 * Jam dinding adalah keadaan di luar React, jadi dibaca lewat
 * useSyncExternalStore, bukan useState yang diisi di dalam useEffect.
 * Snapshot-nya sengaja berupa boolean supaya nilainya stabil antar render
 * dan React tidak melihat perubahan pada tiap milidetik.
 */
function useMeetingOpen(scheduledAtMs: number): boolean {
  const opensAt = scheduledAtMs - OPEN_BEFORE_MS;
  return useSyncExternalStore(
    subscribe,
    () => Date.now() >= opensAt,
    // Server tidak tahu jam browser; render pertama selalu bertombol mati
    // supaya HTML server dan client tidak berbeda.
    () => false,
  );
}

export function MeetingLink({
  url,
  scheduledAtMs,
}: {
  url: string;
  scheduledAtMs: number;
}) {
  const open = useMeetingOpen(scheduledAtMs);

  if (!open) {
    return (
      <div className="space-y-1">
        <Button type="button" size="sm" variant="outline" disabled>
          <Video data-icon="inline-start" />
          Gabung meeting
        </Button>
        <p className="text-xs text-plum-500">
          Aktif mulai 15 menit sebelum sesi dimulai.
        </p>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      nativeButton={false}
      render={<a href={url} target="_blank" rel="noopener noreferrer" />}
    >
      <Video data-icon="inline-start" />
      Gabung meeting
    </Button>
  );
}
