import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth-guard";
import { guardPageAccess } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { loadStudentProgress } from "@/lib/student-progress";
import { Button } from "@/components/ui/button";
import { ProgressView } from "@/components/progress/progress-view";

export const metadata: Metadata = { title: "Progres Murid" };

/**
 * Progres satu murid untuk orang tua (PRD F-4d).
 *
 * guardPageAccess yang menegakkan skenario Privasi di PRD: orang tua yang
 * mengarang id anak orang lain di URL berhenti di halaman 403, bukan
 * melihat data anak orang.
 */
export default async function ParentStudentProgressPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const user = await requireAuth();
  const { studentId } = await params;

  await guardPageAccess(user, { kind: "student", studentId });

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { fullName: true },
  });
  if (!student) notFound();

  const progress = await loadStudentProgress(studentId);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="xs"
          nativeButton={false}
          render={<Link href="/parent/progress" />}
        >
          <ChevronLeft data-icon="inline-start" />
          Kembali ke daftar murid
        </Button>

        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            {student.fullName}
          </h1>
          <p className="text-sm text-plum-500">
            Perkembangan bacaan dari sesi ke sesi.
          </p>
        </div>
      </div>

      <ProgressView progress={progress} />
    </div>
  );
}
