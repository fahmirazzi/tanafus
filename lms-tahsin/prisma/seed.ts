import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { Gender, Relation, RoleName } from "../src/generated/prisma/enums.ts";

const prisma = new PrismaClient();

const SEED_PASSWORD = "password123";
const BCRYPT_ROUNDS = 10;

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  // ---------------------------------------------------------------- roles
  const roleNames = Object.values(RoleName);
  for (const name of roleNames) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const roleId = (name: RoleName): number => {
    const found = roles.find((r) => r.name === name);
    if (!found) throw new Error(`Role ${name} tidak ditemukan`);
    return found.id;
  };

  // --------------------------------------------------------- pricing tiers
  // BR-03.1: tarif privat ditentukan per durasi, tidak ada tarif flat.
  const tiers = [
    { durationMinutes: 30, price: 50000 },
    { durationMinutes: 45, price: 70000 },
    { durationMinutes: 60, price: 90000 },
  ];
  for (const tier of tiers) {
    await prisma.pricingTier.upsert({
      where: { durationMinutes: tier.durationMinutes },
      update: { price: tier.price, isActive: true },
      create: { ...tier, isActive: true },
    });
  }

  // ------------------------------------------------------- rubrik penilaian
  // PRD F-4a: empat kriteria skala 0-100 yang dinilai guru tiap sesi privat.
  // Di-upsert lewat name (unik) supaya seed boleh dijalankan berulang.
  const criteria = [
    {
      name: "Makharijul Huruf",
      description: "Ketepatan tempat keluarnya huruf.",
    },
    {
      name: "Sifatul Huruf",
      description: "Ketepatan sifat yang melekat pada huruf.",
    },
    { name: "Tajwid", description: "Penerapan hukum bacaan." },
    { name: "Kelancaran", description: "Kelancaran dan kestabilan bacaan." },
  ];
  for (const criterion of criteria) {
    await prisma.gradeCriterion.upsert({
      where: { name: criterion.name },
      update: { description: criterion.description },
      create: { ...criterion, maxScore: 100, scope: "private" },
    });
  }

  // ---------------------------------------------------------------- users
  async function upsertUser(input: {
    email: string;
    fullName: string;
    role: RoleName;
    gender?: Gender;
    birthDate?: string;
    isActive?: boolean;
  }): Promise<string> {
    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: { fullName: input.fullName },
      create: {
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        gender: input.gender,
        birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
        isActive: input.isActive ?? true,
      },
      select: { id: true },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleId(input.role) } },
      update: {},
      create: { userId: user.id, roleId: roleId(input.role) },
    });

    return user.id;
  }

  await upsertUser({
    email: "superadmin@tanafus.test",
    fullName: "Super Admin Tanafus",
    role: RoleName.super_admin,
  });

  await upsertUser({
    email: "admin@tanafus.test",
    fullName: "Admin Operasional",
    role: RoleName.admin,
  });

  const guru1Id = await upsertUser({
    email: "guru1@tanafus.test",
    fullName: "Ustadz Abdurrahman",
    role: RoleName.teacher,
    gender: Gender.male,
  });

  const guru2Id = await upsertUser({
    email: "guru2@tanafus.test",
    fullName: "Ustadzah Khadijah",
    role: RoleName.teacher,
    gender: Gender.female,
  });

  // BR-05.1: revenue share default 60%.
  for (const userId of [guru1Id, guru2Id]) {
    await prisma.teacherProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        bio: "Pengajar Tahsin bersertifikat.",
        specialties: ["tahsin", "tajwid"],
        acceptsPrivate: true,
        acceptingStudents: true,
        yearsExperience: 5,
        revenueSharePct: 60,
      },
    });
  }

  const ortu1Id = await upsertUser({
    email: "ortu1@tanafus.test",
    fullName: "Bapak Hasan",
    role: RoleName.parent,
    gender: Gender.male,
  });

  const ortu2Id = await upsertUser({
    email: "ortu2@tanafus.test",
    fullName: "Ibu Aminah",
    role: RoleName.parent,
    gender: Gender.female,
  });

  const murid1Id = await upsertUser({
    email: "murid1@tanafus.test",
    fullName: "Fatimah Hasan",
    role: RoleName.student,
    gender: Gender.female,
    birthDate: "2015-04-12",
  });

  const murid2Id = await upsertUser({
    email: "murid2@tanafus.test",
    fullName: "Yusuf Hasan",
    role: RoleName.student,
    gender: Gender.male,
    birthDate: "2013-09-30",
  });

  const murid3Id = await upsertUser({
    email: "murid3@tanafus.test",
    fullName: "Maryam Aminah",
    role: RoleName.student,
    gender: Gender.female,
    birthDate: "2014-01-20",
  });

  // -------------------------------------------------------- parent linking
  const links = [
    { parentId: ortu1Id, studentId: murid1Id, relation: Relation.father, isPrimary: true },
    { parentId: ortu1Id, studentId: murid2Id, relation: Relation.father, isPrimary: true },
    { parentId: ortu2Id, studentId: murid3Id, relation: Relation.mother, isPrimary: true },
  ];
  for (const link of links) {
    await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: {
          parentId: link.parentId,
          studentId: link.studentId,
        },
      },
      update: {},
      create: link,
    });
  }

  console.log("Seed selesai.");
  console.log(`Semua akun memakai kata sandi: ${SEED_PASSWORD}`);
  console.table([
    { email: "superadmin@tanafus.test", role: "super_admin" },
    { email: "admin@tanafus.test", role: "admin" },
    { email: "guru1@tanafus.test", role: "teacher" },
    { email: "guru2@tanafus.test", role: "teacher" },
    { email: "ortu1@tanafus.test", role: "parent" },
    { email: "ortu2@tanafus.test", role: "parent" },
    { email: "murid1@tanafus.test", role: "student" },
    { email: "murid2@tanafus.test", role: "student" },
    { email: "murid3@tanafus.test", role: "student" },
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
