-- CreateTable
CREATE TABLE "public"."PlacementRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "quizScore" DECIMAL(5,2),
    "interviewNotes" TEXT,
    "audioUrl" TEXT,
    "verdict" TEXT NOT NULL,
    "recommendedCourseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlacementRecord_studentId_idx" ON "public"."PlacementRecord"("studentId");

-- AddForeignKey
ALTER TABLE "public"."PlacementRecord" ADD CONSTRAINT "PlacementRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlacementRecord" ADD CONSTRAINT "PlacementRecord_recommendedCourseId_fkey" FOREIGN KEY ("recommendedCourseId") REFERENCES "public"."Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlacementRecord" ADD CONSTRAINT "PlacementRecord_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

