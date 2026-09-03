-- AlterTable
ALTER TABLE "public"."StudentBreak" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "StudentBreak_teacherId_status_idx" ON "public"."StudentBreak"("teacherId", "status");

-- CreateIndex
CREATE INDEX "StudentBreak_studentId_status_idx" ON "public"."StudentBreak"("studentId", "status");

-- AddForeignKey
ALTER TABLE "public"."StudentBreak" ADD CONSTRAINT "StudentBreak_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentBreak" ADD CONSTRAINT "StudentBreak_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

