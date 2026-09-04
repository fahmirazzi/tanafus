import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { guardPageAccess } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { loadStudentProgress } from "@/lib/student-progress";
import { RoleName } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { ProgressView } from "@/components/progress/progress-view";

export const metadata: Metadata = { title: "Progres Murid" };

/**
 * Riwayat penilaian satu murid dari sisi guru (PRD F-4d).
 *
 * Memakai tampilan yang sama dengan halaman orang tua: kalau guru dan
 * orang tua membicarakan angka yang sama, keduanya harus melihat angka
 * yang sama pula.
 */
export default async function TeacherStudentProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const teacher = await requireRole(RoleName.teacher);
  const { id } = await params;

  // Guru hanya boleh membuka murid yang memang terhubung dengannya lewat
  // penugasan, jadwal, atau riwayat sesi.
  await guardPageAccess(teacher, { kind: "student", studentId: id });

  const student = await prisma.user.findUnique({
    where: { id },
    select: { fullName: true },
  });
  if (!student) notFound();

  const progress = await loadStudentProgress(id);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="xs"
          nativeButton={false}
          render={<Link href="/teacher/students" />}
        >
          <ChevronLeft data-icon="inline-start" />
          Kembali ke murid saya
        </Button>

        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            {student.fullName}
          </h1>
          <p className="text-sm text-plum-500">
            Riwayat penilaian dan feedback yang Anda tulis.
          </p>
        </div>
      </div>

      <ProgressView progress={progress} />
    </div>
  );
}
