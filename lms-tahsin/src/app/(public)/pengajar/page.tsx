import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { initials } from "@/lib/initials";

export const metadata: Metadata = {
  title: "Guru Privat",
  description: "Daftar pengajar privat Tanafus Center.",
};

/**
 * Tanpa ini Next memprerender halaman saat build, sehingga status "kuota
 * penuh" yang baru diubah guru tidak pernah muncul.
 */
export const dynamic = "force-dynamic";

export default async function TeacherDirectoryPage() {
  // Halaman publik: SELECT eksplisit, tidak boleh ada revenueSharePct,
  // email, atau nomor HP yang ikut terbawa.
  const teachers = await prisma.teacherProfile.findMany({
    where: { acceptsPrivate: true, user: { isActive: true } },
    select: {
      userId: true,
      bio: true,
      specialties: true,
      yearsExperience: true,
      acceptingStudents: true,
      user: { select: { fullName: true } },
    },
    orderBy: [{ acceptingStudents: "desc" }, { user: { fullName: "asc" } }],
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Guru privat
        </h1>
        <p className="text-sm text-plum-500">
          Pilih guru yang cocok, lalu ajukan lewat akun orang tua Anda.
        </p>
      </div>

      {teachers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-plum-500">
            Belum ada guru privat yang membuka pendaftaran.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teachers.map((teacher) => (
            <Card key={teacher.userId}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-plum-100 font-heading text-sm font-semibold text-plum-800"
                  >
                    {initials(teacher.user.fullName)}
                  </span>
                  <div className="space-y-1">
                    <Link
                      href={`/pengajar/${teacher.userId}`}
                      className="font-heading text-lg font-semibold text-plum-800 underline-offset-4 hover:underline"
                    >
                      {teacher.user.fullName}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          teacher.acceptingStudents ? "default" : "destructive"
                        }
                      >
                        {teacher.acceptingStudents
                          ? "Menerima murid"
                          : "Kuota penuh"}
                      </Badge>
                      {teacher.yearsExperience ? (
                        <span className="text-xs text-plum-500">
                          {teacher.yearsExperience} tahun mengajar
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {teacher.bio ? (
                  <p className="line-clamp-3 text-sm text-plum-700">
                    {teacher.bio}
                  </p>
                ) : null}

                {teacher.specialties.length > 0 ? (
                  <p className="text-xs text-plum-500">
                    {teacher.specialties.join(" · ")}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
