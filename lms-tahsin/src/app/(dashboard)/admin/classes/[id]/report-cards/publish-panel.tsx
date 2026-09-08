"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/form-feedback";
import { formatTanggalJamWIB } from "@/lib/datetime";

/**
 * Bentuk `details` yang mungkin dikirim server saat menolak penerbitan:
 * PublishBlockers (422, tanggal SUDAH lewat JSON jadi string ISO) atau
 * `{ alreadyPublished }` (409). Kedua bentuk opsional karena error lain
 * (mis. 422 "Data tidak valid" dari zod) bisa mengirim bentuk berbeda lagi
 * — lihat fallback JSON mentah di ErrorDetails di bawah.
 */
type ErrorDetails = {
  outstandingMakeups?: Array<{ sessionId: string; scheduledAt: string }>;
  staleSessions?: Array<{ sessionId: string; scheduledAt: string }>;
  studentsWithoutSessions?: Array<{ studentId: string; fullName: string }>;
  alreadyPublished?: number;
};

/**
 * Menampilkan detail penolakan APA ADANYA dari respons server, bukan pesan
 * generik — admin harus bisa bertindak langsung dari sini (spec B4 §4.4).
 * Bentuk yang tidak dikenali (mis. field error zod) jatuh ke dump JSON
 * mentah supaya tidak ada informasi yang hilang begitu saja.
 */
function ErrorDetails({ details }: { details: unknown }) {
  if (details === null || details === undefined) return null;
  if (typeof details !== "object") return null;
  const d = details as ErrorDetails;

  const known =
    (d.outstandingMakeups && d.outstandingMakeups.length > 0) ||
    (d.staleSessions && d.staleSessions.length > 0) ||
    (d.studentsWithoutSessions && d.studentsWithoutSessions.length > 0) ||
    d.alreadyPublished !== undefined;

  if (!known) {
    const dump = JSON.stringify(details, null, 2);
    if (dump === "{}") return null;
    return (
      <pre className="whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-plum-700">
        {dump}
      </pre>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-plum-700">
      {d.outstandingMakeups && d.outstandingMakeups.length > 0 && (
        <div>
          <p className="font-semibold text-destructive">
            Kewajiban make-up terbuka:
          </p>
          <ul className="list-disc pl-5">
            {d.outstandingMakeups.map((s) => (
              <li key={s.sessionId}>
                Sesi {formatTanggalJamWIB(new Date(s.scheduledAt))}
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.staleSessions && d.staleSessions.length > 0 && (
        <div>
          <p className="font-semibold text-destructive">Sesi belum ditutup:</p>
          <ul className="list-disc pl-5">
            {d.staleSessions.map((s) => (
              <li key={s.sessionId}>
                Sesi {formatTanggalJamWIB(new Date(s.scheduledAt))}
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.studentsWithoutSessions && d.studentsWithoutSessions.length > 0 && (
        <div>
          <p className="font-semibold text-destructive">Murid tanpa sesi:</p>
          <ul className="list-disc pl-5">
            {d.studentsWithoutSessions.map((s) => (
              <li key={s.studentId}>{s.fullName}</li>
            ))}
          </ul>
        </div>
      )}
      {d.alreadyPublished !== undefined && (
        <p>
          Rapor kelas ini sudah pernah terbit ({d.alreadyPublished} murid).
          Kirim konfirmasi untuk menerbitkan ulang.
        </p>
      )}
    </div>
  );
}

/**
 * Panel penerbitan rapor sekelas (spec B4 §4.4) + tautan unduhan CSV.
 *
 * `hasBlockers`/`alreadyPublished` SENGAJA dibaca langsung dari prop di
 * setiap render, tidak pernah disalin ke useState: keduanya ditentukan
 * server dari data yang bisa berubah lewat aksi LAIN (mis. admin membereskan
 * sesi basi lalu kembali ke halaman ini, atau race penerbitan dari tab lain
 * yang membuahkan router.refresh()). Menyalinnya ke state berarti mengulangi
 * bug Task 4 (state lokal tidak menyerap ulang prop setelah refresh) —
 * `error`/`blockers` DI BAWAH aman disimpan di state karena keduanya
 * SELALU direset ke null di awal setiap percobaan publish() yang baru,
 * jadi tidak pernah membawa nilai basi lintas render melewati satu siklus
 * request.
 */
export function PublishPanel({
  classGroupId,
  hasBlockers,
  alreadyPublished,
}: {
  classGroupId: string;
  hasBlockers: boolean;
  alreadyPublished: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<unknown>(null);

  async function publish(confirm: boolean) {
    setBusy(true);
    setError(null);
    setDetails(null);
    const res = await fetch(
      `/api/class-groups/${classGroupId}/report-cards/publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      },
    );
    const json = await res.json();
    if (!res.ok) {
      // Daftar penghalang dari server ditampilkan apa adanya: admin harus
      // bisa bertindak dari pesannya, bukan menebak.
      setError(json?.error ?? "Gagal menerbitkan rapor");
      setDetails(json?.details ?? null);
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  function onPublishClick() {
    if (alreadyPublished) {
      // Konfirmasi lebih dulu (spec B4 §4.4): penerbitan ulang menimpa
      // rapor yang sudah pernah dilihat/diunduh orang tua.
      const ok = window.confirm(
        "Kelas ini sudah pernah terbit. Menerbitkan ulang akan menimpa rapor yang sudah ada. Lanjutkan?",
      );
      if (!ok) return;
      void publish(true);
    } else {
      void publish(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Terbitkan rapor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormAlert message={error} />
        <ErrorDetails details={details} />

        <Button
          type="button"
          disabled={busy || hasBlockers}
          onClick={onPublishClick}
        >
          {busy
            ? "Memproses…"
            : alreadyPublished
              ? "Terbitkan ulang"
              : "Terbitkan rapor sekelas"}
        </Button>
        {hasBlockers && (
          <p className="text-xs text-plum-500">
            Tombol nonaktif selama masih ada gerbang merah di atas.
          </p>
        )}

        <div className="flex flex-wrap gap-4 border-t border-plum-100 pt-4 text-sm">
          {/* <a> biasa, BUKAN fetch/onClick: browser menangani unduhannya
              sendiri tanpa JavaScript perantara — pola yang sama dengan
              layar Laporan (admin/reports). */}
          <a
            className="inline-flex items-center gap-1 text-plum-700 underline"
            href={`/api/reports/attendance?classGroupId=${classGroupId}`}
          >
            <Download className="size-4" />
            Unduh CSV kehadiran
          </a>
          <a
            className="inline-flex items-center gap-1 text-plum-700 underline"
            href={`/api/reports/report-cards?classGroupId=${classGroupId}`}
          >
            <Download className="size-4" />
            Unduh CSV rapor
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
