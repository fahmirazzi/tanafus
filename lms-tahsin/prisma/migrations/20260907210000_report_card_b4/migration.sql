-- CreateEnum
CREATE TYPE "public"."ReportCardStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "public"."ReportCard" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "attendancePct" DECIMAL(5,2),
    "sessionsHeld" INTEGER NOT NULL,
    "sessionsAttended" INTEGER NOT NULL,
    "finalGradeComputed" DECIMAL(5,2),
    "finalGradeOverride" DECIMAL(5,2),
    "overrideReason" TEXT,
    "attendanceThresholdPct" DECIMAL(5,2) NOT NULL,
    "eligibleForNextLevel" BOOLEAN,
    "teacherNote" TEXT,
    "status" "public"."ReportCardStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReportCardScore" (
    "id" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "criterionId" INTEGER NOT NULL,
    "averageScore" DECIMAL(5,2) NOT NULL,
    "sessionsScored" INTEGER NOT NULL,

    CONSTRAINT "ReportCardScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportCard_enrollmentId_key" ON "public"."ReportCard"("enrollmentId");

-- CreateIndex
CREATE INDEX "ReportCard_status_idx" ON "public"."ReportCard"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardScore_reportCardId_criterionId_key" ON "public"."ReportCardScore"("reportCardId", "criterionId");

-- AddForeignKey
ALTER TABLE "public"."ReportCard" ADD CONSTRAINT "ReportCard_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "public"."Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportCard" ADD CONSTRAINT "ReportCard_publishedBy_fkey" FOREIGN KEY ("publishedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportCardScore" ADD CONSTRAINT "ReportCardScore_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "public"."ReportCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportCardScore" ADD CONSTRAINT "ReportCardScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "public"."GradeCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed mengunci keempat kriteria ke scope 'private' dan cabang update-nya
-- tidak pernah menyentuh scope, sehingga sampai hari ini TIDAK ADA satu pun
-- kriteria yang tersedia untuk kelas reguler. Idempoten dan menyempit.
UPDATE "GradeCriterion" SET "scope" = 'both' WHERE "scope" = 'private';
