import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { listStudentsByIds, viewableStudentIds } from "@/lib/students";
import { RoleName } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Progres Anak" };

/**
 * Pintu masuk halaman progres (PRD F-4d). Orang tua dengan satu anak pun
 * tetap melewati daftar ini supaya tautannya sama untuk semua orang.
 */
export default async function ParentProgressPage() {
  const user = await requireRole(RoleName.parent, RoleName.student);
  const students = await listStudentsByIds(await viewableStudentIds(user));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Progres murid
        </h1>
        <p className="text-sm text-plum-500">
          Nilai per kriteria, tren antar sesi, dan catatan guru.
        </p>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-plum-500">
            Belum ada murid yang terhubung dengan akun Anda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <Card key={student.id}>
              <CardHeader>
                <CardTitle className="text-base">{student.fullName}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/parent/progress/${student.id}`} />}
                >
                  Lihat progres
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
