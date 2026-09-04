-- AlterTable
-- DEFAULT sementara dipasang lalu dilepas, supaya baris yang sudah ada
-- (kalau ada) tetap lolos NOT NULL. Nilainya lalu dibackfill dari
-- Session.scheduledAt milik masing-masing baris -- perkiraan yang wajar
-- untuk baris lama, karena kolom ini baru ada mulai sekarang dan baris
-- yang sudah "approved" sebelumnya sudah mengubah scheduledAt sesi ke
-- proposedAt (satu-satunya kasus di mana perkiraan ini meleset, dan
-- hanya memengaruhi tampilan riwayat, bukan data keuangan atau jadwal).
ALTER TABLE "public"."RescheduleRequest" ADD COLUMN     "originalScheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "public"."RescheduleRequest" AS rr
SET "originalScheduledAt" = s."scheduledAt"
FROM "public"."Session" AS s
WHERE s."id" = rr."sessionId";

ALTER TABLE "public"."RescheduleRequest" ALTER COLUMN "originalScheduledAt" DROP DEFAULT;
