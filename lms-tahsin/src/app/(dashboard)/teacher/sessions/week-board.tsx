"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GripVertical, Move } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert, FormNotice } from "@/components/form-feedback";
import { SESSION_STATUS_LABEL } from "@/lib/validations/session";
import { DAY_OF_WEEK_LABEL } from "@/lib/validations/schedule";
import { SessionStatus } from "@/generated/prisma/enums";

export type BoardSession = {
  id: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  studentName: string;
  status: SessionStatus;
  notes: string | null;
};

export function WeekBoard({
  days,
  sessions,
  todayKey,
}: {
  days: string[];
  sessions: BoardSession[];
  todayKey: string;
}) {
  const router = useRouter();

  const [dragging, setDragging] = useState<BoardSession | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [openMove, setOpenMove] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { date: string; time: string }>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Hanya sesi yang belum berjalan yang boleh dipindah. */
  const movable = (s: BoardSession) => s.status === SessionStatus.scheduled;

  async function move(
    session: BoardSession,
    date: string,
    startTime: string,
  ): Promise<void> {
    setFormError(null);
    setNotice(null);

    if (date === session.dateKey && startTime === session.startTime) {
      setOpenMove(null);
      return;
    }

    setBusyId(session.id);
    const response = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, startTime }),
    });
    const payload: unknown = await response.json();
    setBusyId(null);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      const firstDetail = body.details
        ? Object.values(body.details)[0]
        : undefined;
      setFormError(firstDetail ?? body.error ?? "Gagal memindah sesi.");
      return;
    }

    setOpenMove(null);
    setNotice(
      `Sesi ${session.studentName} dipindah ke ${date} pukul ${startTime}.`,
    );
    router.refresh();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, day: string): void {
    e.preventDefault();
    setHoverDay(null);
    const session = dragging;
    setDragging(null);
    if (!session || session.dateKey === day) return;
    // Digeser antar hari mempertahankan jamnya; ubah jam lewat panel Pindahkan.
    void move(session, day, session.startTime);
  }

  return (
    <div className="space-y-4">
      <FormAlert message={formError} />
      <FormNotice message={notice} />

      <p className="text-xs text-plum-500">
        Geser kartu sesi ke hari lain untuk memindahkannya (jam tetap sama),
        atau pakai tombol Pindahkan untuk mengatur tanggal dan jam sekaligus.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {days.map((day) => {
          const list = sessions.filter((s) => s.dateKey === day);
          const dow = new Date(`${day}T12:00:00.000Z`).getUTCDay();
          const isDropTarget =
            hoverDay === day && dragging !== null && dragging.dateKey !== day;

          return (
            <Card
              key={day}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setHoverDay(day);
              }}
              onDragLeave={() => setHoverDay((prev) => (prev === day ? null : prev))}
              onDrop={(e) => handleDrop(e, day)}
              className={
                isDropTarget
                  ? "border-orange-500 bg-orange-50"
                  : day === todayKey
                    ? "border-plum-700"
                    : ""
              }
            >
              <CardHeader>
                <CardTitle className="text-sm">
                  {DAY_OF_WEEK_LABEL[dow]}
                  <span className="block text-xs font-normal text-plum-500">
                    {day}
                    {day === todayKey ? " · hari ini" : ""}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {list.length === 0 ? (
                  <p className="text-xs text-plum-500">
                    {isDropTarget ? "Lepas di sini" : "Tidak ada sesi."}
                  </p>
                ) : null}

                {list.map((session) => {
                  const canMove = movable(session);
                  const draft =
                    drafts[session.id] ??
                    { date: session.dateKey, time: session.startTime };

                  return (
                    <div
                      key={session.id}
                      draggable={canMove && busyId === null}
                      onDragStart={() => setDragging(session)}
                      onDragEnd={() => {
                        setDragging(null);
                        setHoverDay(null);
                      }}
                      className={`space-y-1 rounded-md border border-border p-2 ${
                        canMove ? "cursor-grab active:cursor-grabbing" : ""
                      } ${busyId === session.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium text-plum-800">
                          {session.startTime}–{session.endTime}
                        </p>
                        {canMove ? (
                          <GripVertical
                            aria-hidden="true"
                            className="size-4 shrink-0 text-plum-400"
                          />
                        ) : null}
                      </div>
                      <p className="text-xs text-plum-700">
                        {session.studentName}
                      </p>
                      <Badge variant="secondary">
                        {SESSION_STATUS_LABEL[session.status]}
                      </Badge>
                      {session.notes ? (
                        <p className="text-xs text-plum-500">{session.notes}</p>
                      ) : null}

                      <Button
                        variant="ghost"
                        size="xs"
                        nativeButton={false}
                        render={<Link href={`/teacher/sessions/${session.id}`} />}
                      >
                        Detail &amp; feedback
                        <ArrowRight data-icon="inline-end" />
                      </Button>

                      {canMove ? (
                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            aria-expanded={openMove === session.id}
                            onClick={() =>
                              setOpenMove((prev) =>
                                prev === session.id ? null : session.id,
                              )
                            }
                          >
                            <Move data-icon="inline-start" />
                            Pindahkan
                          </Button>

                          {openMove === session.id ? (
                            <div className="mt-2 space-y-2 border-t border-border pt-2">
                              <div className="space-y-1">
                                <Label htmlFor={`date-${session.id}`}>
                                  Tanggal
                                </Label>
                                <Input
                                  id={`date-${session.id}`}
                                  type="date"
                                  value={draft.date}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [session.id]: {
                                        ...draft,
                                        date: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`time-${session.id}`}>Jam</Label>
                                <Input
                                  id={`time-${session.id}`}
                                  type="time"
                                  value={draft.time}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [session.id]: {
                                        ...draft,
                                        time: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                disabled={busyId === session.id}
                                onClick={() =>
                                  void move(session, draft.date, draft.time)
                                }
                              >
                                {busyId === session.id
                                  ? "Memindah..."
                                  : "Simpan"}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
