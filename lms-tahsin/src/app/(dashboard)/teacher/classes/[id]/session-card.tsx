"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormAlert, FormNotice } from "@/components/form-feedback";
import { formatRupiah } from "@/lib/currency";
import {
  canApplyRegularAction,
  REGULAR_ACTIONS,
  REGULAR_ACTION_CONFIRM,
  REGULAR_ACTION_LABEL,
  type RegularAction,
} from "@/lib/regular-sessions";
import { SESSION_STATUS_LABEL } from "@/lib/validations/session";
import { SessionStatus } from "@/generated/prisma/enums";
import { buildGradePayload, mergeServerGrades, scoresAfterSave } from "./grade-form";

export type LessonOption = { id: string; label: string };
export type RosterStudent = { studentId: string; fullName: string };
export type CriterionOption = { id: number; name: string; maxScore: number };
export type GradeRow = { studentId: string; criterionId: number; score: number };

export type SessionRow = {
  id: string;
  scheduledAtLabel: string;
  dateInput: string;
  timeInput: string;
  durationMinutes: number;
  status: SessionStatus;
  lessonId: string | null;
  marks: Record<string, { status: string; excuseReason: string }>;
};

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Hadir" },
  { value: "late", label: "Terlambat" },
  { value: "absent", label: "Absen" },
  { value: "excused", label: "Izin" },
];

/**
 * Status kosong = guru BELUM memilih apa pun untuk murid ini.
 *
 * Sengaja tidak ada nilai awal "Hadir": BR-02.6a menjadikan kehadiran gerbang
 * kenaikan level, dan gerbang server (spec §5.3) hanya bermakna kalau layarnya
 * tidak mengisinya sendiri. Prasetel diam-diam justru lebih buruk daripada
 * tanpa gerbang — hasilnya tampak seperti keputusan guru padahal bukan.
 */
const UNMARKED = "";

const selectClass =
  "h-9 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

/** Bentuk `GradeRow[]` dari server menjadi state `scores` layar (dan sebaliknya, sebagai snapshot pembanding). */
function gradesToScores(rows: GradeRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const g of rows) result[`${g.studentId}:${g.criterionId}`] = String(g.score);
  return result;
}

/**
 * Satu sesi kelas reguler: roster dengan penanda kehadiran, pemilih
 * lesson, dan tombol Mulai/Selesai/Batalkan.
 *
 * Kehadiran WAJIB satu request untuk seluruh roster (Task 7) — dua belas
 * murid tidak boleh menjadi dua belas perjalanan bolak-balik, jadi seluruh
 * tanda disimpan di state lalu dikirim sekaligus lewat PUT.
 */
export function SessionCard({
  session,
  roster,
  lessons,
  criteria,
  grades,
}: {
  session: SessionRow;
  roster: RosterStudent[];
  lessons: LessonOption[];
  criteria: CriterionOption[];
  grades: GradeRow[];
}) {
  const router = useRouter();

  const [attendance, setAttendance] = useState<
    Record<string, { status: string; excuseReason: string }>
  >(() =>
    Object.fromEntries(
      roster.map((r) => {
        const saved = session.marks[r.studentId];
        // `no_info` adalah nilai bawaan kolom, bukan pilihan guru — di layar
        // ia diperlakukan sama dengan belum ditandai.
        const status =
          saved && saved.status !== "no_info" ? saved.status : UNMARKED;
        return [
          r.studentId,
          { status, excuseReason: saved?.excuseReason ?? "" },
        ];
      }),
    ),
  );
  const [lessonId, setLessonId] = useState(session.lessonId ?? "");
  const [pending, setPending] = useState<RegularAction | null>(null);
  const [makeupDate, setMakeupDate] = useState("");
  const [makeupTime, setMakeupTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Penilaian hanya berlaku untuk sesi yang sudah selesai — endpoint (Task 3)
  // menolak sesi lain, jadi menampilkan formnya di status lain hanya
  // memancing galat 422.
  const canGrade =
    session.status === SessionStatus.completed ||
    session.status === SessionStatus.completed_absent;

  const [scores, setScores] = useState<Record<string, string>>(() =>
    gradesToScores(grades),
  );
  // Snapshot `grades` (bukan `scores`!) tepat setelah render/merge terakhir —
  // dipakai mergeServerGrades() untuk mengenali sel mana yang BERUBAH di
  // server sejak terakhir kali disinkron, terlepas dari apa yang sedang
  // diketik guru di `scores`.
  const previousGrades = useRef<Record<string, string>>(gradesToScores(grades));

  /**
   * `SessionCard` dirender dengan `key` yang stabil (page.tsx), sehingga
   * `router.refresh()` — dipicu saveGrades() MAUPUN saveAttendance() di kartu
   * yang sama — tidak pernah me-remount komponen ini. Tanpa efek ini,
   * `scores` yang diinisialisasi sekali lewat useState(() => ...) tidak akan
   * pernah menyerap `grades` yang baru: sel yang dikosongkan guru (lalu
   * sengaja tidak dikirim oleh buildGradePayload) akan tampak kosong
   * SELAMANYA walau server masih menyimpan nilai lama.
   *
   * useEffect polos yang menimpa `scores` dari `grades` TIDAK dipakai di sini
   * karena itu juga akan membuang ketikan guru yang belum disimpan saat
   * refresh dipicu oleh saveAttendance() di kartu yang sama —
   * mergeServerGrades() membedakan kedua kasus itu.
   */
  useEffect(() => {
    const serverAfter = gradesToScores(grades);
    // Tangkap nilai ref ke variabel lokal SEBELUM memanggil setScores.
    // Closure JavaScript dalam updater membaca `.current` saat updater
    // benar-benar dieksekusi (bukan saat setScores dipanggil), dan jika
    // baris berikutnya sudah memutasi ref, updater akan melihat nilai baru.
    // React umumnya menjalankan updater sinkron, tapi mode dev dan efek
    // tertunda lainnya dapat membuat updater dieksekusi SETELAH mutasi ref,
    // menyebabkan serverBefore === serverAfter dan kehilangan deteksi sel
    // yang benar-benar berubah di server.
    const serverBefore = previousGrades.current;
    setScores((local) =>
      mergeServerGrades({ serverBefore, local, serverAfter }),
    );
    previousGrades.current = serverAfter;
    // Sengaja hanya bergantung pada `grades`: `scores` diakses lewat updater
    // fungsional (`setScores((local) => ...)`) supaya efek ini tidak perlu
    // (dan tidak boleh) berjalan ulang setiap kali guru mengetik.
  }, [grades]);

  const [gradeError, setGradeError] = useState<string | null>(null);
  const [savingGrades, setSavingGrades] = useState(false);

  async function saveGrades() {
    setSavingGrades(true);
    setGradeError(null);
    // Hanya kirim sel yang benar-benar diisi: penilaian tidak wajib, dan sel
    // kosong berarti "belum dinilai", bukan nol.
    const payload = buildGradePayload(scores);
    // Snapshot server ditangkap ke variabel lokal SEBELUM fetch: selagi
    // request berjalan, useEffect([grades]) (dipicu router.refresh() dari
    // aksi lain di kartu yang sama) bisa memutasi previousGrades.current.
    // Hasil simpan ini harus dihitung relatif terhadap keadaan server saat
    // `payload` dibentuk, bukan terhadap nilai ref apa pun yang kebetulan
    // ada saat respons tiba.
    const serverSnapshot = previousGrades.current;

    if (payload.length === 0) {
      // Semua sel kosong, jadi tidak ada yang bisa dikirim (penghapusan nilai
      // di luar lingkup B4). Layar tetap WAJIB disinkronkan ulang: kalau guru
      // mengosongkan satu-satunya sel yang terisi, server masih menyimpan
      // nilainya, dan tanpa baris ini sel itu tampak kosong sampai halaman
      // di-reload penuh — persis kelas bug yang jalur sukses di bawah tutup.
      setScores((local) =>
        mergeServerGrades({
          serverBefore: serverSnapshot,
          local,
          serverAfter: serverSnapshot,
        }),
      );
      // Pesannya dibedakan: kalau server memang masih menyimpan nilai, "belum
      // ada nilai yang diisi" menyesatkan — sel barusan dipulihkan di depan
      // mata guru, jadi yang perlu dijelaskan adalah KENAPA pengosongannya
      // tidak tersimpan.
      setGradeError(
        Object.keys(serverSnapshot).length > 0
          ? "Nilai tidak bisa dikosongkan lewat layar ini. Sel yang dikosongkan dikembalikan ke nilai yang tersimpan."
          : "Belum ada nilai yang diisi",
      );
      setSavingGrades(false);
      return;
    }
    const res = await fetch(`/api/sessions/${session.id}/grades`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grades: payload }),
    });
    const json = await res.json();
    if (!res.ok) {
      setGradeError(json?.details?.grades ?? json?.error ?? "Gagal menyimpan nilai");
    } else {
      // JANGAN menggantungkan resinkronisasi ke sini pada router.refresh():
      // mengosongkan sebuah sel lalu menyimpan TIDAK mengubah apa pun di
      // server (buildGradePayload sengaja tidak mengirim sel kosong), jadi
      // payload RSC yang diambil ulang oleh refresh() akan identik dengan
      // sebelumnya — React tidak membuat referensi prop `grades` baru,
      // useEffect(..., [grades]) di atas tidak pernah menyala, dan sel yang
      // dikosongkan akan tampak kosong SELAMANYA sampai halaman di-reload
      // penuh. Sebagai gantinya, hitung `scores` berikutnya SECARA LOKAL:
      // mulai dari snapshot server terakhir yang diketahui, lalu timpa
      // dengan apa yang barusan benar-benar tersimpan (payload ini). Sel
      // yang dikosongkan (tidak ikut di payload) otomatis jatuh kembali ke
      // nilai server dari snapshot; sel yang baru disimpan menampilkan nilai
      // barunya.
      const nextServer = scoresAfterSave({
        serverSnapshot,
        savedPayload: payload,
      });
      // WAJIB updater fungsional yang dikomposisikan dengan mergeServerGrades,
      // BUKAN setScores(nextServer) dengan nilai biasa: input tabel sengaja
      // tidak di-disabled selagi menyimpan, jadi guru bisa mengetik di sel
      // lain SETELAH `payload` ditangkap. Nilai biasa akan mengganti SELURUH
      // state dan menghapus ketikan itu diam-diam — tanpa galat, tanpa tanda
      // apa pun. mergeServerGrades sudah membedakan kedua kasus: sel lokal
      // yang BERISI dan berbeda dari snapshot saat kirim dianggap sedang
      // disunting (dipertahankan), sedangkan sel kosong selalu jatuh ke nilai
      // server sehingga perbaikan bug aslinya tetap berlaku.
      setScores((local) =>
        mergeServerGrades({
          serverBefore: serverSnapshot,
          local,
          serverAfter: nextServer,
        }),
      );
      previousGrades.current = nextServer;
      // Tetap dipanggil untuk kasus lain (mis. guru/admin lain menyunting
      // data yang sama di tempat lain) — useEffect([grades]) di atas masih
      // berguna KALAU refresh ini kebetulan membawa referensi `grades` baru
      // yang benar-benar berbeda. Tidak menghapusnya sengaja: itu bukan
      // duplikasi, hanya tidak lagi menjadi SATU-SATUNYA jalur resinkronisasi.
      router.refresh();
    }
    setSavingGrades(false);
  }

  const available = REGULAR_ACTIONS.filter((action) =>
    canApplyRegularAction(session.status, action),
  );

  const unmarkedCount = roster.filter(
    (r) => !attendance[r.studentId]?.status,
  ).length;
  const rosterComplete = unmarkedCount === 0;

  function setMark(studentId: string, status: string): void {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
  }

  /**
   * Tanda yang BERUBAH sejak layar dimuat.
   *
   * Bukan seluruh roster: setiap kiriman menulis ulang markedAt/markedBy,
   * jadi mengirim tanda yang tidak disentuh akan mengatasnamakan penekan
   * tombol atas keputusan orang lain — kehadiran yang tadinya ditandai admin
   * atau guru pengganti mendadak tercatat sebagai keputusan guru ini. Murid
   * yang belum ditandai juga tidak ikut: tidak ada status yang bisa dikarang
   * untuk mereka.
   */
  function changedMarks(): {
    studentId: string;
    status: string;
    excuseReason: string;
  }[] {
    return roster
      .filter((r) => {
        const current = attendance[r.studentId];
        if (!current?.status) return false;
        const saved = session.marks[r.studentId];
        if (!saved || saved.status === "no_info") return true;
        return (
          saved.status !== current.status ||
          (saved.excuseReason ?? "") !== (current.excuseReason ?? "")
        );
      })
      .map((r) => ({
        studentId: r.studentId,
        status: attendance[r.studentId].status,
        excuseReason: attendance[r.studentId].excuseReason ?? "",
      }));
  }

  /**
   * SATU request untuk seluruh perubahan (Task 7) — dua belas murid tidak
   * boleh menjadi dua belas perjalanan bolak-balik.
   *
   * "noop" bukan kegagalan: tidak ada yang berubah, jadi tidak ada yang perlu
   * dikirim. Pemanggilnya yang memutuskan apakah itu layak dilaporkan.
   */
  async function putAttendance(): Promise<"ok" | "noop" | "failed"> {
    const marks = changedMarks();
    if (marks.length === 0) return "noop";

    const response = await fetch(`/api/sessions/${session.id}/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marks }),
    });
    const payload: unknown = await response.json();

    if (!response.ok) {
      const body = payload as { error?: string };
      setError(body.error ?? "Gagal menyimpan kehadiran.");
      return "failed";
    }
    return "ok";
  }

  async function saveAttendance(): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);

    const outcome = await putAttendance();
    setBusy(false);
    if (outcome === "failed") return;

    if (outcome === "noop") {
      // Dibedakan supaya guru tahu MANA yang terjadi: roster yang belum
      // disentuh sama sekali bukan hal yang sama dengan roster yang memang
      // sudah tersimpan seperti ini.
      setNotice(
        unmarkedCount === roster.length
          ? "Belum ada kehadiran yang ditandai."
          : "Tidak ada perubahan untuk disimpan.",
      );
      return;
    }

    setNotice("Kehadiran tersimpan.");
    router.refresh();
  }

  async function submitAction(action: RegularAction): Promise<void> {
    if (action === "cancel_institution" && (!makeupDate || !makeupTime)) {
      setError("Tanggal dan jam sesi pengganti wajib diisi untuk membatalkan kelas.");
      return;
    }
    if (action === "complete" && !rosterComplete) {
      setError(
        `Masih ada ${unmarkedCount} murid tanpa status kehadiran. Tandai semuanya lebih dulu.`,
      );
      setPending(null);
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    // Menutup kelas menuntut roster lengkap di sisi server (spec §5.3).
    // Tanda yang baru dipilih di layar disimpan lebih dulu supaya guru tidak
    // tertahan 422 hanya karena lupa menekan "Simpan kehadiran".
    if (action === "complete" && roster.length > 0) {
      // "noop" lolos: roster memang sudah lengkap tersimpan, tidak ada yang
      // perlu ditulis ulang.
      if ((await putAttendance()) === "failed") {
        setBusy(false);
        setPending(null);
        return;
      }
    }

    const response = await fetch(`/api/sessions/${session.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        lessonId,
        ...(action === "cancel_institution"
          ? { makeupAt: { date: makeupDate, startTime: makeupTime } }
          : {}),
      }),
    });
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      const firstDetail = body.details
        ? Object.values(body.details)[0]
        : undefined;
      setError(firstDetail ?? body.error ?? "Gagal memperbarui status sesi.");
      setPending(null);
      return;
    }

    const data = (
      payload as { data?: { earning?: { amount: number } | null } }
    ).data;
    setPending(null);
    setNotice(
      data?.earning
        ? `Kelas ditandai "${REGULAR_ACTION_LABEL[action]}". Honor Anda ${formatRupiah(data.earning.amount)}.`
        : `Kelas ditandai "${REGULAR_ACTION_LABEL[action]}".`,
    );
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{session.scheduledAtLabel}</CardTitle>
          <Badge variant="secondary">{SESSION_STATUS_LABEL[session.status]}</Badge>
        </div>
        <p className="text-xs text-plum-500">{session.durationMinutes} menit</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormAlert message={error} />
        <FormNotice message={notice} />

        <div className="space-y-2">
          <Label htmlFor={`lesson-${session.id}`}>Lesson yang diajarkan</Label>
          <select
            id={`lesson-${session.id}`}
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            className={selectClass}
          >
            <option value="">— Belum dipilih —</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-plum-800">Kehadiran</p>
          {roster.length === 0 ? (
            <p className="text-sm text-plum-500">Belum ada murid aktif di roster.</p>
          ) : (
            <ul className="space-y-2">
              {roster.map((r) => (
                <li
                  key={r.studentId}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2"
                >
                  <span className="text-sm text-plum-700">{r.fullName}</span>
                  <select
                    aria-label={`Kehadiran ${r.fullName}`}
                    value={attendance[r.studentId]?.status ?? UNMARKED}
                    onChange={(e) => setMark(r.studentId, e.target.value)}
                    className={`${selectClass} w-36`}
                  >
                    <option value={UNMARKED}>— Belum ditandai —</option>
                    {ATTENDANCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
          {roster.length > 0 && !rosterComplete ? (
            <p className="text-sm text-plum-500">
              {unmarkedCount} dari {roster.length} murid belum ditandai. Kelas
              baru bisa ditutup setelah semuanya punya status kehadiran.
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || roster.length === 0}
            onClick={() => void saveAttendance()}
          >
            {busy ? "Menyimpan..." : "Simpan kehadiran"}
          </Button>
        </div>

        {canGrade ? (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold text-plum-800">Penilaian</p>
            {roster.length === 0 || criteria.length === 0 ? (
              <p className="text-sm text-plum-500">
                {roster.length === 0
                  ? "Belum ada murid aktif di roster."
                  : "Belum ada kriteria penilaian untuk kelas reguler."}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-plum-500">
                        <th className="py-2 pr-2 font-medium">Murid</th>
                        {criteria.map((c) => (
                          <th key={c.id} className="py-2 px-2 font-medium">
                            {c.name}
                            <span className="block text-xs font-normal text-plum-400">
                              maks {c.maxScore}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((r) => (
                        <tr key={r.studentId} className="border-b border-border">
                          <td className="py-2 pr-2 whitespace-nowrap text-plum-700">
                            {r.fullName}
                          </td>
                          {criteria.map((c) => {
                            const key = `${r.studentId}:${c.id}`;
                            return (
                              <td key={c.id} className="py-2 px-2">
                                <Input
                                  aria-label={`${c.name} untuk ${r.fullName}`}
                                  type="number"
                                  min={0}
                                  max={c.maxScore}
                                  inputMode="decimal"
                                  value={scores[key] ?? ""}
                                  onChange={(e) =>
                                    setScores((prev) => ({
                                      ...prev,
                                      [key]: e.target.value,
                                    }))
                                  }
                                  className="w-20"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <FormAlert message={gradeError} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={savingGrades}
                  onClick={() => void saveGrades()}
                >
                  {savingGrades ? "Menyimpan..." : "Simpan nilai"}
                </Button>
              </>
            )}
          </div>
        ) : null}

        {available.length === 0 ? (
          <p className="rounded-md bg-cream-100 px-3 py-2 text-sm text-plum-700">
            Status sesi ini sudah final dan tidak bisa diubah lagi.
          </p>
        ) : (
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              {available.map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant={action === "cancel_institution" ? "destructive" : "default"}
                  size="sm"
                  disabled={busy || (action === "complete" && !rosterComplete)}
                  onClick={() => setPending(action)}
                >
                  {REGULAR_ACTION_LABEL[action]}
                </Button>
              ))}
            </div>
            {available.includes("complete") && !rosterComplete ? (
              <p className="text-sm text-plum-500">
                &quot;Selesai&quot; terkunci: {unmarkedCount} murid belum
                ditandai kehadirannya.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending ? REGULAR_ACTION_LABEL[pending] : ""}</DialogTitle>
            <DialogDescription>
              {pending ? REGULAR_ACTION_CONFIRM[pending] : ""}
            </DialogDescription>
          </DialogHeader>

          {pending === "cancel_institution" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="makeup-date">Tanggal pengganti</Label>
                <Input
                  id="makeup-date"
                  type="date"
                  value={makeupDate}
                  onChange={(e) => setMakeupDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="makeup-time">Jam pengganti</Label>
                <Input
                  id="makeup-time"
                  type="time"
                  value={makeupTime}
                  onChange={(e) => setMakeupTime(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                busy ||
                (pending === "complete" && !rosterComplete) ||
                (pending === "cancel_institution" && (!makeupDate || !makeupTime))
              }
              onClick={() => {
                if (pending) void submitAction(pending);
              }}
            >
              {busy ? "Menyimpan..." : "Ya, lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
