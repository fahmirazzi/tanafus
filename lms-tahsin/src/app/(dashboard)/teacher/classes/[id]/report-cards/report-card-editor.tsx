"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FormNotice } from "@/components/form-feedback";

export type ReportCardRow = {
  reportCardId: string | null;
  studentId: string;
  studentName: string;
  status: "draft" | "published" | null;
  publishedAt: string | null;
  attendancePct: number | null;
  sessionsHeld: number;
  sessionsAttended: number;
  finalGradeComputed: number | null;
  finalGradeOverride: number | null;
  overrideReason: string | null;
  teacherNote: string | null;
  averages: Array<{ criterionId: number; averageScore: number; sessionsScored: number }>;
};

export type StudentWithoutScore = { studentId: string; fullName: string };

function CardEditor({
  row,
  criterionNames,
}: {
  row: ReportCardRow;
  criterionNames: Record<number, string>;
}) {
  const router = useRouter();
  const [note, setNote] = useState(row.teacherNote ?? "");
  const [override, setOverride] = useState(
    row.finalGradeOverride !== null ? String(row.finalGradeOverride) : "",
  );
  const [reason, setReason] = useState(row.overrideReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rapor terbit hanya-baca: route memang menolak menyuntingnya, dan form
  // yang tampak bisa diisi padahal pasti gagal hanya membuang waktu guru.
  const readOnly = row.status === "published";

  // CATATAN state vs. router.refresh() (retro Task 4, layar penilaian
  // kohort butuh EMPAT ronde perbaikan karena useState di sini tidak pernah
  // menyerap ulang prop): note/override/reason SENGAJA tidak punya
  // useEffect penyerap-ulang seperti SessionCard tetangganya, dan itu aman
  // di layar ini — bukan diabaikan begitu saja. Bedanya dengan penilaian
  // kohort ada pada BENTUK payload-nya: save() di bawah selalu mengirim
  // KETIGA field secara utuh (termasuk string kosong untuk "tidak ada
  // catatan/timpaan"), tidak pernah mengosongkan field dengan cara
  // TIDAK mengirimnya. Jadi begitu simpan berhasil, apa yang barusan
  // dikirim ke server SAMA PERSIS dengan apa yang sudah ada di state lokal
  // ini, dan prop segar yang dibawa router.refresh() akan identik dengan
  // state saat ini — tidak ada nilai yang "menghilang" atau "muncul lagi"
  // seperti kasus sel nilai kosong di grade-form.ts. Satu-satunya jalan
  // field ini berubah di server adalah lewat PATCH ini sendiri, jadi tidak
  // ada sumber lain yang bisa membuat prop menyimpang dari state di antara
  // dua refresh. Field yang BISA berubah lewat aksi lain (mis. "Susun ulang
  // draft" mengubah attendancePct/finalGradeComputed, atau penerbitan
  // mengubah status) sengaja TIDAK disalin ke state sama sekali — semuanya
  // dibaca langsung dari `row` tiap render, sehingga otomatis segar setelah
  // router.refresh() tanpa perlu efek tambahan apa pun.
  async function save() {
    if (!row.reportCardId) return;
    setBusy(true);
    setError(null);
    // fetch/res.json() DIBUNGKUS try/catch/finally: tanpa ini, fetch yang
    // gagal (jaringan putus) atau res.json() yang melempar (respons bukan
    // JSON, mis. sesi guru kedaluwarsa) membuat exception keluar SEBELUM
    // setBusy(false) tercapai — tombol "Simpan" terkunci "Menyimpan…"
    // selamanya. `finally` memastikan itu selalu tercapai.
    try {
      const res = await fetch(`/api/report-cards/${row.reportCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherNote: note,
          // Kosong berarti "tidak ada timpaan", bukan nilai nol.
          finalGradeOverride: override.trim() === "" ? null : Number(override),
          overrideReason: reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(
          json?.details?.overrideReason ?? json?.error ?? "Gagal menyimpan rapor",
        );
      } else {
        router.refresh();
      }
    } catch {
      setError("Gagal menghubungi server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{row.studentName}</CardTitle>
          {readOnly && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Terbit</Badge>
              <span className="text-xs text-plum-500">
                {row.publishedAt
                  ? new Date(row.publishedAt).toLocaleDateString("id-ID")
                  : ""}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-plum-700">
          Kehadiran{" "}
          {row.attendancePct === null
            ? "belum bisa dihitung"
            : `${row.attendancePct}% (${row.sessionsAttended} dari ${row.sessionsHeld} sesi)`}
        </p>

        {row.averages.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">Belum ada nilai untuk murid ini</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kriteria</TableHead>
                <TableHead>Rata-rata</TableHead>
                <TableHead>Jumlah nilai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {row.averages.map((a) => (
                <TableRow key={a.criterionId}>
                  <TableCell>
                    {criterionNames[a.criterionId] ?? `Kriteria ${a.criterionId}`}
                  </TableCell>
                  <TableCell>{a.averageScore}</TableCell>
                  <TableCell>{a.sessionsScored}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <p className="text-sm text-plum-700">
          Nilai akhir terhitung:{" "}
          {row.finalGradeComputed === null ? "belum ada" : row.finalGradeComputed}
        </p>

        <div className="space-y-2">
          <Label htmlFor={`note-${row.studentId}`}>Catatan guru</Label>
          <Textarea
            id={`note-${row.studentId}`}
            rows={3}
            placeholder="Catatan guru untuk murid dan orang tua"
            value={note}
            disabled={readOnly || busy}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`override-${row.studentId}`}>
            Timpaan nilai akhir (kosongkan bila tidak menimpa)
          </Label>
          <Input
            id={`override-${row.studentId}`}
            type="number"
            min={0}
            max={100}
            value={override}
            disabled={readOnly || busy}
            onChange={(e) => setOverride(e.target.value)}
          />
        </div>

        {override.trim() !== "" && (
          <div className="space-y-2">
            <Label htmlFor={`reason-${row.studentId}`}>Alasan menimpa nilai (wajib)</Label>
            <Input
              id={`reason-${row.studentId}`}
              value={reason}
              disabled={readOnly || busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        <FormAlert message={error} />

        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !row.reportCardId}
            onClick={() => void save()}
          >
            {busy ? "Menyimpan…" : "Simpan"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Layar rapor kelas: satu kartu per murid, plus tombol untuk menyusun atau
 * menyegarkan draft (spec B4 §4.8). Rapor sudah TERBIT tampil hanya-baca —
 * lihat komentar `readOnly` di CardEditor.
 */
export function ReportCardEditor({
  classGroupId,
  rows,
  criterionNames,
  studentsWithoutScores,
}: {
  classGroupId: string;
  rows: ReportCardRow[];
  criterionNames: Record<number, string>;
  studentsWithoutScores: StudentWithoutScore[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function compose() {
    setBusy(true);
    setError(null);
    setNotice(null);
    // fetch/res.json() DIBUNGKUS try/catch/finally: tanpa ini, fetch yang
    // gagal (jaringan putus) atau res.json() yang melempar (respons bukan
    // JSON) membuat exception keluar SEBELUM setBusy(false) tercapai —
    // tombol "Susun / segarkan draft" terkunci "Menyusun…" selamanya.
    // `finally` memastikan itu selalu tercapai.
    try {
      const res = await fetch(`/api/class-groups/${classGroupId}/report-cards`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Gagal menyusun draft rapor");
        return;
      }
      const { created, refreshed, skippedPublished } = json.data as {
        created: number;
        refreshed: number;
        skippedPublished: number;
      };
      setNotice(
        `Draft tersusun: ${created} baru, ${refreshed} disegarkan` +
          (skippedPublished > 0
            ? `, ${skippedPublished} sudah terbit dilewati`
            : "") +
          ".",
      );
      router.refresh();
    } catch {
      setError("Gagal menghubungi server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-plum-800">
          Rapor per murid
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void compose()}
        >
          {busy ? "Menyusun…" : "Susun / segarkan draft"}
        </Button>
      </div>

      <FormAlert message={error} />
      <FormNotice message={notice} />

      {/* Peringatan, BUKAN penghalang (spec B4 §4.4): murid tanpa nilai
          tetap boleh masuk rapor, jadi ini sekadar informasi untuk guru. */}
      {studentsWithoutScores.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">Murid tanpa nilai (tetap masuk rapor):</p>
          <ul className="list-disc pl-5">
            {studentsWithoutScores.map((s) => (
              <li key={s.studentId}>{s.fullName}</li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-plum-500">
            Belum ada murid terdaftar di kelas ini.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <CardEditor key={row.studentId} row={row} criterionNames={criterionNames} />
          ))}
        </div>
      )}
    </div>
  );
}
