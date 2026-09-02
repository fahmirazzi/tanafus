-- CreateEnum
CREATE TYPE "public"."PrivateAssignmentStatus" AS ENUM ('active', 'paused', 'ended');

-- AlterTable
ALTER TABLE "public"."TeacherRequest" ADD COLUMN     "assignmentId" TEXT,
ADD COLUMN     "handledAt" TIMESTAMP(3),
ADD COLUMN     "rejectReason" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Backfill lalu kunci NOT NULL, supaya migration aman dijalankan
-- di environment yang tabelnya sudah berisi data.
UPDATE "public"."TeacherRequest" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "public"."TeacherRequest" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."PrivateAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "level" TEXT,
    "status" "public"."PrivateAssignmentStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivateAssignment_teacherId_status_idx" ON "public"."PrivateAssignment"("teacherId", "status");

-- CreateIndex
CREATE INDEX "PrivateAssignment_studentId_status_idx" ON "public"."PrivateAssignment"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateAssignment_teacherId_studentId_key" ON "public"."PrivateAssignment"("teacherId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherRequest_assignmentId_key" ON "public"."TeacherRequest"("assignmentId");

-- CreateIndex
CREATE INDEX "TeacherRequest_status_teacherId_idx" ON "public"."TeacherRequest"("status", "teacherId");

-- CreateIndex
CREATE INDEX "TeacherRequest_studentId_createdAt_idx" ON "public"."TeacherRequest"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."TeacherRequest" ADD CONSTRAINT "TeacherRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherRequest" ADD CONSTRAINT "TeacherRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherRequest" ADD CONSTRAINT "TeacherRequest_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."PrivateAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrivateAssignment" ADD CONSTRAINT "PrivateAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrivateAssignment" ADD CONSTRAINT "PrivateAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

