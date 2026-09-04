import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { teacherProfileSchema } from "@/lib/validations/teacher";
import { RoleName } from "@/generated/prisma/enums";

/**
 * Profil guru milik sendiri. Id-nya diambil dari sesi, bukan dari client,
 * sehingga tidak ada jalur IDOR sama sekali di endpoint ini.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const teacher = await requireRole(RoleName.teacher);

    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: teacher.id },
      select: {
        bio: true,
        qualifications: true,
        sanadInfo: true,
        specialties: true,
        acceptsPrivate: true,
        acceptingStudents: true,
        yearsExperience: true,
        revenueSharePct: true,
      },
    });

    if (!profile) {
      return apiOk({ exists: false, profile: null });
    }

    return apiOk({
      exists: true,
      profile: {
        ...profile,
        // Guru boleh melihat bagi hasilnya sendiri, tapi tidak boleh mengubah.
        revenueSharePct: Number(profile.revenueSharePct),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const teacher = await requireRole(RoleName.teacher);

    const body: unknown = await req.json();
    const parsed = teacherProfileSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const {
      bio,
      qualifications,
      sanadInfo,
      specialties,
      acceptsPrivate,
      acceptingStudents,
      yearsExperience,
    } = parsed.data;

    const data = {
      bio: bio?.trim() ? bio.trim() : null,
      qualifications: qualifications?.trim() ? qualifications.trim() : null,
      sanadInfo: sanadInfo?.trim() ? sanadInfo.trim() : null,
      specialties: specialties ?? [],
      acceptsPrivate: acceptsPrivate ?? false,
      acceptingStudents: acceptingStudents ?? false,
      yearsExperience: yearsExperience === "" ? null : yearsExperience ?? null,
    };

    // Baris profil belum tentu ada — guru bisa dibuat admin tanpa profil.
    // revenueSharePct tidak disentuh; biarkan default schema yang berlaku.
    await prisma.teacherProfile.upsert({
      where: { userId: teacher.id },
      create: { userId: teacher.id, ...data },
      update: data,
    });

    return apiOk({ userId: teacher.id });
  } catch (error) {
    return handleApiError(error);
  }
}
