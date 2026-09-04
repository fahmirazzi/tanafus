-- AlterTable
ALTER TABLE "public"."PrivateRecurringSchedule" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "PrivateRecurringSchedule_teacherId_isActive_idx" ON "public"."PrivateRecurringSchedule"("teacherId", "isActive");

-- CreateIndex
CREATE INDEX "PrivateRecurringSchedule_studentId_isActive_idx" ON "public"."PrivateRecurringSchedule"("studentId", "isActive");

-- AddForeignKey
ALTER TABLE "public"."PrivateRecurringSchedule" ADD CONSTRAINT "PrivateRecurringSchedule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrivateRecurringSchedule" ADD CONSTRAINT "PrivateRecurringSchedule_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

