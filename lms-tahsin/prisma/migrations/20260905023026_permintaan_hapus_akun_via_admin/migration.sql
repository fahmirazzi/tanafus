-- AlterTable
ALTER TABLE "public"."AccountDeletionRequest" ADD COLUMN     "requestedBy" TEXT,
ALTER COLUMN "executeAfter" DROP NOT NULL;
