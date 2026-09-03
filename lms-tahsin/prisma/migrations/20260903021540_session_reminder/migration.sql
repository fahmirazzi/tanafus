-- CreateEnum
CREATE TYPE "public"."ReminderKind" AS ENUM ('h1', 'm5');

-- CreateTable
CREATE TABLE "public"."SessionReminder" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" "public"."ReminderKind" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionReminder_sessionId_kind_key" ON "public"."SessionReminder"("sessionId", "kind");

-- AddForeignKey
ALTER TABLE "public"."SessionReminder" ADD CONSTRAINT "SessionReminder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

