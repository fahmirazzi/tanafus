import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatTanggalJamWIB } from "@/lib/datetime";
import { zonedDateKey } from "@/lib/sessions";
import { viewableStudentIds } from "@/lib/students";
import { RESCHEDULE_REQUEST_STATUS_LABEL } from "@/lib/validations/reschedule-request";
import {
  RoleName,
  SessionStatus,
  SessionType,
  SimpleApprovalStatus,
} from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RescheduleButton } from "./reschedule-button";

export const metadata: Metadata = { title: "Jadwal" };

/** Sesi 30 hari ke depan yang ditampilkan — cukup panjang untuk merencanakan
 * lebih dari seminggu, tanpa memuat kalender penuh yang belum ada halamannya. */
const UPCOMING_DAYS = 30;

function statusVariant(
  status: SimpleApprovalStatus,
): "default" | "secondary" | "destructive" {
  if (status === SimpleApprovalStatus.approved) return "default";
  if (status === SimpleApprovalStatus.rejected) return "destructive";
  return "secondary";
}

/**
 * Jadwal semua anak + pengajuan reschedule (PRD F-8 Dashboard Parent
 * "Aksi: ajukan reschedule").
 */
export default async function ParentSchedulePage() {
  const user = await requireRole(RoleName.parent, RoleName.student);
  const studentIds = await viewableStudentIds(user);

  if (studentIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Jadwal
        </h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-plum-500">
            Belum ada anak yang terhubung dengan akun Anda.
          </CardContent>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const upcomingUntil = new Date(now.getTime() + UPCOMING_DAYS * 86_400_000);

  const [sessions, requests] = await Promise.all([
    prisma.session.findMany({
      where: {
        type: SessionType.private,
        studentId: { in: studentIds },
        status: { in: [SessionStatus.scheduled, SessionStatus.in_progress] },
        scheduledAt: { gte: now, lt: upcomingUntil },
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        student: { select: { fullName: true } },
        teacher: { select: { fullName: true } },
        rescheduleRequests: {
          where: { status: SimpleApprovalStatus.pending },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 50,
    }),
    prisma.rescheduleRequest.findMany({
      where: { session: { studentId: { in: studentIds } } },
      select: {
        id: true,
        proposedAt: true,
        reason: true,
        status: true,
        createdAt: true,
        session: {
          select: {
            student: { select: { fullName: true } },
            scheduledAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Jadwal
        </h1>
        <p className="text-sm text-plum-500">
          Sesi {UPCOMING_DAYS} hari ke depan untuk semua anak. Butuh waktu
          lain? Ajukan reschedule, guru yang memutuskan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sesi mendatang ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-plum-500">
              Tidak ada sesi terjadwal dalam {UPCOMING_DAYS} hari ke depan.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-plum-800">
                      {session.student?.fullName ?? "Murid"} ·{" "}
                      {formatTanggalJamWIB(session.scheduledAt)}
                    </p>
                    <p className="text-xs text-plum-500">
                      {session.durationMinutes} menit bersama{" "}
                      {session.teacher?.fullName ?? "guru"}
                    </p>
                  </div>
                  <RescheduleButton
                    sessionId={session.id}
                    studentName={session.student?.fullName ?? "Murid"}
                    defaultDate={zonedDateKey(session.scheduledAt)}
                    hasOpenRequest={session.rescheduleRequests.length > 0}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {requests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat pengajuan</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="space-y-1 rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-plum-800">
                      {request.session.student?.fullName ?? "Murid"} · usul{" "}
                      {formatTanggalJamWIB(request.proposedAt)}
                    </p>
                    <Badge variant={statusVariant(request.status)}>
                      {RESCHEDULE_REQUEST_STATUS_LABEL[request.status]}
                    </Badge>
                  </div>
                  {request.reason ? (
                    <p className="text-xs text-plum-500">
                      Alasan: {request.reason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
