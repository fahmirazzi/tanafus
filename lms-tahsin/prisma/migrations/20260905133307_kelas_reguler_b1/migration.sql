-- CreateEnum
CREATE TYPE "public"."ClassAudience" AS ENUM ('children', 'adult');

-- AlterTable
ALTER TABLE "public"."ClassGroup" ADD COLUMN     "audience" "public"."ClassAudience" NOT NULL,
ADD COLUMN     "honorPerSession" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "teacherId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "attendanceThresholdPct" DECIMAL(5,2) NOT NULL DEFAULT 75;

-- AlterTable
ALTER TABLE "public"."Enrollment" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "droppedAt" TIMESTAMP(3),
ADD COLUMN     "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Session" ADD COLUMN     "lessonId" TEXT;

-- CreateTable
CREATE TABLE "public"."Module" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassGroupSchedule" (
    "id" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "meetingUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassGroupSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Module_courseId_orderIndex_idx" ON "public"."Module"("courseId", "orderIndex");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_orderIndex_idx" ON "public"."Lesson"("moduleId", "orderIndex");

-- CreateIndex
CREATE INDEX "ClassGroupSchedule_classGroupId_isActive_idx" ON "public"."ClassGroupSchedule"("classGroupId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ClassGroupSchedule_classGroupId_dayOfWeek_startTime_key" ON "public"."ClassGroupSchedule"("classGroupId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Session_classGroupId_scheduledAt_key" ON "public"."Session"("classGroupId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "public"."ClassGroup" ADD CONSTRAINT "ClassGroup_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "public"."Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassGroupSchedule" ADD CONSTRAINT "ClassGroupSchedule_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "public"."ClassGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

