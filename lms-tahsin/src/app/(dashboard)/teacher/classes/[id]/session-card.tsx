"use client";

import { useState } from "react";
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

export type LessonOption = { id: string; label: string };
export type RosterStudent = { studentId: string; fullName: string };

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
}: {
  session: SessionRow;
  roster: RosterStudent[];
  lessons: LessonOption[];
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
