-- AlterTable
ALTER TABLE "public"."InvoiceItem" ADD COLUMN     "enrollmentChargeId" TEXT;

-- CreateTable
CREATE TABLE "public"."EnrollmentCharge" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "public"."ChargeStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentCharge_enrollmentId_installmentNo_key" ON "public"."EnrollmentCharge"("enrollmentId", "installmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceItem_enrollmentChargeId_key" ON "public"."InvoiceItem"("enrollmentChargeId");

-- AddForeignKey
ALTER TABLE "public"."EnrollmentCharge" ADD CONSTRAINT "EnrollmentCharge_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "public"."Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."AcademicPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceItem" ADD CONSTRAINT "InvoiceItem_enrollmentChargeId_fkey" FOREIGN KEY ("enrollmentChargeId") REFERENCES "public"."EnrollmentCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

