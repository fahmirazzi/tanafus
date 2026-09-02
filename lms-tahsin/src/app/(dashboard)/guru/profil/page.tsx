import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { RoleName } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TeacherProfileForm,
  type TeacherProfileValues,
} from "./teacher-profile-form";

export const metadata: Metadata = { title: "Profil Guru" };

export default async function TeacherProfilePage() {
  const teacher = await requireRole(RoleName.teacher);

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: teacher.id },
    select: {
      bio: true,
      qualifications: true,
      sanadInfo: true,
      specialties: true,
      yearsExperience: true,
      acceptsPrivate: true,
      acceptingStudents: true,
      revenueSharePct: true,
    },
  });

  const initial: TeacherProfileValues = {
    bio: profile?.bio ?? "",
    qualifications: profile?.qualifications ?? "",
    sanadInfo: profile?.sanadInfo ?? "",
    specialties: profile?.specialties.join(", ") ?? "",
    yearsExperience:
      profile?.yearsExperience === null || profile?.yearsExperience === undefined
        ? ""
        : String(profile.yearsExperience),
    acceptsPrivate: profile?.acceptsPrivate ?? false,
    acceptingStudents: profile?.acceptingStudents ?? true,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            Profil guru
          </h1>
          <p className="text-sm text-plum-500">
            Isi ini yang dilihat calon murid saat memilih guru privat.
          </p>
        </div>
        {profile?.acceptsPrivate ? (
          <Link
            href={`/pengajar/${teacher.id}`}
            className="inline-flex items-center gap-1 text-sm text-plum-700 underline underline-offset-4"
          >
            Lihat halaman publik
            <ExternalLink className="size-4" />
          </Link>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data profil</CardTitle>
        </CardHeader>
        <CardContent>
          <TeacherProfileForm initial={initial} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bagi hasil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-plum-800">
            Anda menerima{" "}
            <strong>
              {profile ? Number(profile.revenueSharePct) : 60}%
            </strong>{" "}
            dari nilai setiap sesi yang selesai.
          </p>
          <p className="text-plum-500">
            Angka ini hanya bisa diubah admin. Hubungi admin bila ada
            kesepakatan berbeda.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
