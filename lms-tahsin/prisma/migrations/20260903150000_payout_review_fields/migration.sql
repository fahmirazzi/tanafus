-- AlterTable
ALTER TABLE "public"."Payout" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Payout_teacherId_status_idx" ON "public"."Payout"("teacherId", "status");

-- CreateIndex
CREATE INDEX "Payout_status_requestedAt_idx" ON "public"."Payout"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "PayoutItem_payoutId_idx" ON "public"."PayoutItem"("payoutId");

-- CreateIndex
CREATE INDEX "SessionEarning_teacherId_status_idx" ON "public"."SessionEarning"("teacherId", "status");

-- CreateIndex
CREATE INDEX "SessionEarning_status_createdAt_idx" ON "public"."SessionEarning"("status", "createdAt");

