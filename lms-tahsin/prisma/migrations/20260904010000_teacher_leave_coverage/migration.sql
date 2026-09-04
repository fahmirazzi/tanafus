-- AlterTable
ALTER TABLE "public"."TeacherLeave" DROP COLUMN "resolution",
DROP COLUMN "substituteTeacherId",
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "endedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."TeacherLeaveCoverage" (
    "id" TEXT NOT NULL,
    "leaveId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "choice" TEXT,
    "substituteTeacherId" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherLeaveCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherLeaveCoverage_studentId_idx" ON "public"."TeacherLeaveCoverage"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherLeaveCoverage_leaveId_assignmentId_key" ON "public"."TeacherLeaveCoverage"("leaveId", "assignmentId");

-- CreateIndex
CREATE INDEX "TeacherLeave_teacherId_status_idx" ON "public"."TeacherLeave"("teacherId", "status");

-- AddForeignKey
ALTER TABLE "public"."TeacherLeave" ADD CONSTRAINT "TeacherLeave_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherLeaveCoverage" ADD CONSTRAINT "TeacherLeaveCoverage_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "public"."TeacherLeave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherLeaveCoverage" ADD CONSTRAINT "TeacherLeaveCoverage_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."PrivateAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherLeaveCoverage" ADD CONSTRAINT "TeacherLeaveCoverage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherLeaveCoverage" ADD CONSTRAINT "TeacherLeaveCoverage_substituteTeacherId_fkey" FOREIGN KEY ("substituteTeacherId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

