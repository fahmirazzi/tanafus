const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Get a regular session
  const session = await prisma.session.findFirst({
    where: { type: "regular", status: "scheduled" },
    select: {
      id: true,
      teacherId: true,
      classGroupId: true,
      scheduledAt: true,
      durationMinutes: true,
    },
  });

  if (!session) {
    console.log("No regular session found");
    process.exit(0);
  }

  console.log(`Found session: ${session.id}`);
  console.log(`Teacher: ${session.teacherId}`);
  console.log(`Class Group: ${session.classGroupId}`);

  // Get active enrollments for this class
  const enrollments = await prisma.enrollment.findMany({
    where: { classGroupId: session.classGroupId, status: "active" },
    select: { studentId: true },
  });

  console.log(`Active students: ${enrollments.length}`);
  const studentIds = enrollments.map((e) => e.studentId);

  // Get parent links
  const parentLinks = await prisma.parentStudent.findMany({
    where: { studentId: { in: studentIds } },
    select: { parentId: true, studentId: true },
  });

  const parentIds = [...new Set(parentLinks.map((l) => l.parentId))];
  console.log(`Parents: ${parentIds.length}`);

  const expectedAudience = [...studentIds, ...parentIds];
  console.log(`\nExpected notification audience (${expectedAudience.length}): ${expectedAudience.join(", ")}`);
  console.log(`Teacher (should NOT be in audience): ${session.teacherId}`);
}

main().catch(console.error).finally(() => process.exit(0));
