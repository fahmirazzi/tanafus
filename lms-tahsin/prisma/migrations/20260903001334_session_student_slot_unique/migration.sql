-- DropIndex
DROP INDEX "public"."Session_studentId_scheduledAt_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Session_studentId_scheduledAt_key" ON "public"."Session"("studentId", "scheduledAt");

