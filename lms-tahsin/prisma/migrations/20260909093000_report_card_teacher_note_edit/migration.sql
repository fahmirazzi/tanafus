-- Catatan guru boleh diperbaiki setelah rapor terbit; angkanya tetap beku.
--
-- Kolom ini menandai narasi yang BERUBAH sesudah penerbitan, supaya PDF rapor
-- bisa menyatakannya kepada orang tua. Sengaja TIDAK diturunkan dari
-- "updatedAt": kolom itu ikut berubah pada penerbitan ulang, jadi ia tidak
-- bisa membedakan "narasinya diperbaiki" dari "angkanya dihitung ulang".
--
-- Nullable tanpa default: baris yang sudah ada tetap NULL, dan itu benar apa
-- adanya — narasinya memang belum pernah disunting sesudah terbit.
ALTER TABLE "ReportCard" ADD COLUMN "teacherNoteUpdatedAt" TIMESTAMP(3);
