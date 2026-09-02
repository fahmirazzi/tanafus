import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { initials } from "@/lib/initials";

type PageParams = { params: Promise<{ id: string }> };

/**
 * Kolom yang boleh tampil di halaman publik. revenueSharePct, email, dan
 * nomor HP sengaja TIDAK ada di sini.
 */
const PUBLIC_SELECT = {
  userId: true,
  bio: true,
  qualifications: true,
  sanadInfo: true,
  specialties: true,
  yearsExperience: true,
  acceptingStudents: true,
  user: { select: { fullName: true } },
};

async function getTeacher(id: string) {
  return prisma.teacherProfile.findFirst({
    where: { userId: id, acceptsPrivate: true, user: { isActive: true } },
    select: PUBLIC_SELECT,
  });
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { id } = await params;
  const teacher = await getTeacher(id);
  if (!teacher) return { title: "Guru tidak ditemukan" };
  return {
    title: teacher.user.fullName,
    description: teacher.bio ?? "Pengajar privat Tanafus Center.",
  };
}

export default async function TeacherPublicPage({ params }: PageParams) {
  const { id } = await params;
  const teacher = await getTeacher(id);

  // Guru yang tidak menerima privat atau akunnya nonaktif diperlakukan
  // sebagai tidak ada, bukan 403 — halaman ini publik.
  if (!teacher) notFound();

  const sections = [
    { title: "Kualifikasi", body: teacher.qualifications },
    { title: "Sanad", body: teacher.sanadInfo },
  ].filter((s) => Boolean(s.body));

  return (
    <div className="space-y-6">
      <Link
        href="/instructors"
        className="inline-flex items-center gap-1 text-sm text-plum-500 hover:text-plum-700"
      >
        <ArrowLeft className="size-4" />
        Kembali ke daftar guru
      </Link>

      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-plum-100 font-heading text-lg font-semibold text-plum-800"
        >
          {initials(teacher.user.fullName)}
        </span>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            {teacher.user.fullName}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={teacher.acceptingStudents ? "default" : "destructive"}>
              {teacher.acceptingStudents ? "Menerima murid" : "Kuota penuh"}
            </Badge>
            {teacher.yearsExperience ? (
              <span className="text-sm text-plum-500">
                {teacher.yearsExperience} tahun mengajar
              </span>
            ) : null}
          </div>
          {teacher.specialties.length > 0 ? (
            <p className="text-sm text-plum-500">
              {teacher.specialties.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      {teacher.bio ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perkenalan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-plum-700">
              {teacher.bio}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-plum-700">
              {section.body}
            </p>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="space-y-2 pt-6 text-sm">
          <p className="text-plum-800">
            {teacher.acceptingStudents
              ? "Ingin belajar dengan guru ini?"
              : "Kuota guru ini sedang penuh."}
          </p>
          <p className="text-plum-500">
            {teacher.acceptingStudents
              ? "Masuk sebagai orang tua, lalu ajukan pendaftaran privat."
              : "Anda tetap bisa mengajukan dan akan masuk daftar tunggu."}{" "}
            <Link
              href="/login"
              className="text-plum-700 underline underline-offset-4"
            >
              Masuk
            </Link>{" "}
            atau{" "}
            <Link
              href="/register"
              className="text-plum-700 underline underline-offset-4"
            >
              daftar akun
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
