/**
 * Rubrik penilaian yang berlaku untuk sesi privat (PRD F-4a).
 *
 * Kolom GradeCriterion.scope memisahkan rubrik privat dari rubrik kelas
 * reguler yang menyusul di fase 2; "both" berarti kriteria itu dipakai
 * keduanya. Dipusatkan di sini supaya route dan halaman membaca daftar
 * kriteria yang persis sama.
 */
export const PRIVATE_CRITERION_SCOPES = ["private", "both"];

/** Rubrik yang berlaku untuk kelas reguler (spec B4 §4.3). */
export const REGULAR_CRITERION_SCOPES = ["regular", "both"];

/** Kolom kriteria yang dibutuhkan form penilaian maupun halaman progres. */
export const CRITERION_SELECT = {
  id: true,
  name: true,
  description: true,
  maxScore: true,
};
