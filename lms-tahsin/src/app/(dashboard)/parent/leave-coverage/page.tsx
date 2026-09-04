import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatTanggalWIB } from "@/lib/datetime";
import { PUBLIC_TEACHER_WHERE } from "@/lib/teachers";
import { viewableStudentIds } from "@/lib/students";
import { LEAVE_COVERAGE_CHOICE_LABEL } from "@/lib/teacher-leave";
import { RoleName } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CoverageChoiceForm } from "./coverage-choice-form";

export const metadata: Metadata = { title: "Cuti Guru Anak" };

/**
 * Pilihan orang tua saat guru anaknya cuti panjang (PRD F-7a, BR-06.3).
 *
 * Hanya muncul kalau ada — kebanyakan orang tua tidak akan pernah melihat
 * halaman ini isinya apa pun selain "tidak ada", dan itu keadaan normal,
 * bukan kosong karena rusak.
 */
export default async function ParentLeaveCoveragePage() {
  const user = await requireRole(RoleName.parent, RoleName.student);
  const studentIds = await viewableStudentIds(user);

  const [pending, decided, substitutes] = await Promise.all([
    studentIds.length > 0
      ? prisma.teacherLeaveCoverage.findMany({
          where: { studentId: { in: studentIds }, choice: null },
          select: {
            id: true,
            studentId: true,
            student: { select: { fullName: true } },
            leave: {
              select: {
                startDate: true,
                endDate: true,
                teacherId: true,
                teacher: { select: { fullName: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    studentIds.length > 0
      ? prisma.teacherLeaveCoverage.findMany({
          where: { studentId: { in: studentIds }, NOT: { choice: null } },
          select: {
            id: true,
            choice: true,
            student: { select: { fullName: true } },
            substitute: { select: { fullName: true } },
            leave: { select: { teacher: { select: { fullName: true } } } },
          },
          orderBy: { decidedAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
    prisma.teacherProfile.findMany({
      where: PUBLIC_TEACHER_WHERE,
      select: { userId: true, user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Cuti guru anak
        </h1>
        <p className="text-sm text-plum-500">
          Saat guru privat anak Anda cuti panjang, pilih di sini: guru
          pengganti sementara, atau jeda jadwal sampai guru kembali.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Perlu keputusan Anda ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending.length === 0 ? (
            <p className="text-sm text-plum-500">Tidak ada yang perlu diputuskan.</p>
          ) : (
            pending.map((row) => {
              const options = substitutes
                .filter((s) => s.userId !== row.leave.teacherId)
                .map((s) => ({ id: s.userId, fullName: s.user.fullName }));
              return (
                <div
                  key={row.id}
                  className="space-y-3 rounded-md border border-border p-4"
                >
                  <p className="text-sm text-plum-700">
                    <span className="font-medium text-plum-800">
                      {row.leave.teacher.fullName}
                    </span>{" "}
                    (guru {row.student.fullName}) sedang cuti panjang
                    {row.leave.endDate
                      ? `, sampai ${formatTanggalWIB(row.leave.endDate)}`
                      : ""}
                    .
                  </p>
                  <CoverageChoiceForm
                    coverageId={row.id}
                    studentName={row.student.fullName}
                    teachers={options}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {decided.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat pilihan</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {decided.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
                >
                  <span className="text-plum-700">
                    {row.student.fullName} · {row.leave.teacher.fullName}
                    {row.substitute ? ` → ${row.substitute.fullName}` : ""}
                  </span>
                  <Badge variant="secondary">
                    {row.choice
                      ? LEAVE_COVERAGE_CHOICE_LABEL[
                          row.choice as "substitute" | "pause"
                        ]
                      : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
