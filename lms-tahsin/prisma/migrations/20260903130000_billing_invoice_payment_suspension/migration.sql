-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('pending', 'verified', 'rejected');

-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_invoiceId_fkey";

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "gatewayToken" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "status" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ALTER COLUMN "paidAt" DROP NOT NULL,
ALTER COLUMN "paidAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspensionReason" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "public"."Invoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_studentId_status_idx" ON "public"."Invoice"("studentId", "status");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "public"."InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "public"."Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_status_idx" ON "public"."Payment"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "SessionCharge_studentId_status_createdAt_idx" ON "public"."SessionCharge"("studentId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Penomoran invoice.
--
-- Cron bundel bulanan menerbitkan banyak invoice dalam satu jalan, dan mode
-- per_session menerbitkan invoice dari request guru yang bisa bersamaan.
-- Menghitung "invoice ke-berapa bulan ini" lewat COUNT() akan bertabrakan di
-- kondisi itu; sequence Postgres memberi angka unik tanpa kunci baris.
-- Nomor boleh berlubang bila sebuah transaksi dibatalkan — nextval memang
-- tidak ikut rollback — dan itu diterima: yang wajib adalah nomor unik dan
-- tidak pernah dipakai ulang.
CREATE SEQUENCE IF NOT EXISTS "public"."invoice_number_seq" AS BIGINT START WITH 1;
