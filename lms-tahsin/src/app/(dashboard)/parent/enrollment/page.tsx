import type { Metadata } from "next";
import Link from "next/link";
import { hasRole, requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { RoleName } from "@/generated/prisma/enums";
import { formatPreferredTimes } from "@/lib/teacher-requests";
import { formatTanggalWIB } from "@/lib/datetime";
import { REQUEST_STATUS_LABEL } from "@/lib/validations/teacher-request";
import { TeacherRequestStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnrollmentForm } from "./enrollment-form";

export const metadata: Metadata = { title: "Pendaftaran Privat" };

function statusVariant(
  status: TeacherRequestStatus,
): "default" | "secondary" | "destructive" {
  if (status === TeacherRequestStatus.approved) return "default";
  if (status === TeacherRequestStatus.rejected) return "destructive";
  return "secondary";
}

export default async function EnrollmentPage() {
  const user = await requireRole(RoleName.parent, RoleName.student);

  // CATATAN SCHEMA: baris anak dari seorang parent dicari lewat parentId
  // (penamaan relasi ParentStudent terbalik dari intuisi).
  const links = hasRole(user, RoleName.parent)
    ? await prisma.parentStudent.findMany({
        where: { parentId: user.id },
        select: { student: { select: { id: true, fullName: true } } },
        orderBy: { student: { fullName: "asc" } },
      })
    : [];

  const self = hasRole(user, RoleName.student)
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, fullName: true },
      })
    : null;

  const students = [
    ...(self ? [self] : []),
    ...links.map((l) => l.student),
  ].filter(
    (student, index, all) =>
      all.findIndex((s) => s.id === student.id) === index,
  );

  const studentIds = students.map((s) => s.id);

  const [tiers, teachers, requests] = await Promise.all([
    prisma.pricingTier.findMany({
      where: { isActive: true },
      select: { durationMinutes: true, price: true },
      orderBy: { durationMinutes: "asc" },
    }),
    prisma.teacherProfile.findMany({
      where: { acceptsPrivate: true, user: { isActive: true } },
      select: {
        userId: true,
        acceptingStudents: true,
        user: { select: { fullName: true } },
      },
      orderBy: [{ acceptingStudents: "desc" }, { user: { fullName: "asc" } }],
    }),
    studentIds.length > 0
      ? prisma.teacherRequest.findMany({
          where: { studentId: { in: studentIds } },
          select: {
            id: true,
            status: true,
            createdAt: true,
            preferredDurations: true,
            preferredTimes: true,
            note: true,
            rejectReason: true,
            student: { select: { fullName: true } },
            teacher: { select: { fullName: true } },
            assignment: {
              select: {
                level: true,
                teacher: { select: { fullName: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Pendaftaran privat
        </h1>
        <p className="text-sm text-plum-500">
          Ajukan guru privat untuk anak Anda. Pengajuan adalah usulan — guru
          atau admin yang memutuskan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status pengajuan</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-plum-500">
              Belum ada pengajuan. Isi formulir di bawah untuk memulai.
            </p>
          ) : (
            <ul className="space-y-4">
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="space-y-2 rounded-md border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-plum-800">
                        {request.student.fullName}
                      </p>
                      <p className="text-sm text-plum-500">
                        Guru:{" "}
                        {request.assignment?.teacher.fullName ??
                          request.teacher?.fullName ??
                          "menunggu penempatan admin"}
                      </p>
                      <p className="text-xs text-plum-500">
                        Diajukan {formatTanggalWIB(request.createdAt)} ·{" "}
                        {request.preferredDurations
                          .map((d) => `${d} menit`)
                          .join(", ")}{" "}
                        · {formatPreferredTimes(request.preferredTimes)}
                      </p>
                    </div>
                    <Badge variant={statusVariant(request.status)}>
                      {REQUEST_STATUS_LABEL[request.status]}
                    </Badge>
                  </div>

                  {request.assignment?.level ? (
                    <p className="text-sm text-plum-700">
                      Level awal: {request.assignment.level}
                    </p>
                  ) : null}

                  {request.rejectReason ? (
                    <div className="space-y-2">
                      <p className="text-sm text-plum-700">
                        Alasan: {request.rejectReason}
                      </p>
                      <Link
                        href="/instructors"
                        className="inline-block text-sm text-plum-700 underline underline-offset-4"
                      >
                        Lihat guru lain
                      </Link>
                    </div>
                  ) : null}

                  {request.status === TeacherRequestStatus.waitlisted ? (
                    <Link
                      href="/instructors"
                      className="inline-block text-sm text-plum-700 underline underline-offset-4"
                    >
                      Lihat guru lain
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajukan guru privat</CardTitle>
        </CardHeader>
        <CardContent>
          <EnrollmentForm
            students={students}
            teachers={teachers.map((t) => ({
              id: t.userId,
              fullName: t.user.fullName,
              acceptingStudents: t.acceptingStudents,
            }))}
            durations={tiers.map((t) => ({
              durationMinutes: t.durationMinutes,
              price: Number(t.price),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
