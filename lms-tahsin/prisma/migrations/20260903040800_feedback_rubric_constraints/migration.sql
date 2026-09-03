-- AlterTable
-- DEFAULT dipasang lalu dilepas supaya baris feedback yang sudah ada (kalau
-- ada) tetap lolos NOT NULL; setelah itu nilainya diisi Prisma lewat @updatedAt.
ALTER TABLE "public"."SessionFeedback" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "public"."SessionFeedback" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "GradeCriterion_name_key" ON "public"."GradeCriterion"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SessionFeedback_sessionId_studentId_key" ON "public"."SessionFeedback"("sessionId", "studentId");
