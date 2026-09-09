/**
 * Logika murni form penilaian, dipisah dari session-card.tsx supaya bisa
 * diuji tanpa merender komponen React atau menyentuh Prisma.
 */

export type GradePayloadItem = {
  studentId: string;
  criterionId: number;
  score: number;
};

/**
 * Menyaring sel `scores` (kunci "studentId:criterionId" → string input)
 * menjadi payload PUT /api/sessions/[id]/grades.
 *
 * Sel kosong (termasuk yang cuma berisi spasi) WAJIB disaring SEBELUM
 * `Number()`: `Number("")` adalah 0, dan kalau sel kosong ikut lolos, nilai
 * "belum dinilai" akan terkirim sebagai nol sungguhan lalu merusak rata-rata
 * rapor. Sel berisi "0" yang sah tetap lolos karena `trim()`-nya bukan string
 * kosong.
 */
export function buildGradePayload(
  scores: Record<string, string>,
): GradePayloadItem[] {
  return Object.entries(scores)
    .filter(([, value]) => value.trim() !== "")
    .map(([key, value]) => {
      const [studentId, criterionId] = key.split(":");
      return { studentId, criterionId: Number(criterionId), score: Number(value) };
    });
}

/**
 * Menghitung state `scores` berikutnya setelah `router.refresh()` membawa
 * prop `grades` yang baru dari server.
 *
 * Kenapa perlu fungsi ini (bukan cuma menimpa `scores` dari `grades`): state
 * `scores` diinisialisasi sekali lewat `useState(() => ...)`, dan
 * `SessionCard` dipakai dengan `key` yang stabil sehingga `router.refresh()`
 * tidak pernah me-remount komponen — tanpa penyerapan eksplisit ini, sel yang
 * dikosongkan guru (lalu sengaja tidak terkirim oleh buildGradePayload) akan
 * tampak kosong selamanya di layar walau server masih menyimpan nilai lama.
 *
 * Sekaligus fungsi ini HARUS membedakan "guru sedang mengetik, belum
 * menyimpan" dari "guru mengosongkan lalu diam": untuk tiap kunci, nilai
 * lokal yang sama dengan snapshot server SEBELUM refresh berarti guru tidak
 * menyuntingnya sejak itu, jadi aman diganti nilai server yang baru.
 *
 * Yang menyunting HANYA dianggap "sedang disunting" (dipertahankan) kalau
 * nilai lokalnya BERISI dan berbeda dari snapshot lama. Nilai lokal yang
 * KOSONG selalu kalah dari server, walau berbeda dari snapshot lama — sebab
 * satu-satunya cara sel kosong itu muncul adalah guru mengosongkannya, dan
 * buildGradePayload() dengan sengaja tidak pernah mengirim sel kosong ke
 * server (penghapusan nilai di luar lingkup B4). Kalau nilai lokal kosong
 * ikut dipertahankan di sini, sel yang dikosongkan lalu "disimpan" akan
 * tampak kosong SELAMANYA di layar walau server masih menyimpan nilai lama —
 * persis bug yang sedang diperbaiki.
 */
export function mergeServerGrades({
  serverBefore,
  local,
  serverAfter,
}: {
  serverBefore: Record<string, string>;
  local: Record<string, string>;
  serverAfter: Record<string, string>;
}): Record<string, string> {
  const keys = new Set([
    ...Object.keys(serverBefore),
    ...Object.keys(local),
    ...Object.keys(serverAfter),
  ]);

  const next: Record<string, string> = {};
  for (const key of keys) {
    const before = serverBefore[key] ?? "";
    const current = local[key] ?? "";
    const after = serverAfter[key] ?? "";
    const isEditingUnsaved = current.trim() !== "" && current !== before;

    next[key] = isEditingUnsaved ? current : after;
  }
  return next;
}

/**
 * Menghitung state `scores` berikutnya SETELAH simpan SUKSES — TANPA
 * menggantungkan resinkronisasi pada `router.refresh()`.
 *
 * Kenapa `router.refresh()` saja tidak cukup di sini (beda dari
 * mergeServerGrades di atas, yang menangani refresh yang MEMANG membawa data
 * baru): mengosongkan sebuah sel lalu menekan "Simpan nilai" TIDAK mengubah
 * apa pun di server — buildGradePayload() dengan sengaja tidak pernah
 * mengirim sel kosong. Karena server tidak berubah, payload RSC yang dikirim
 * ulang oleh router.refresh() akan IDENTIK dengan sebelumnya, React tidak
 * membuat referensi prop `grades` baru untuk subtree ini, dan
 * `useEffect(..., [grades])` tidak pernah menyala — sel yang dikosongkan
 * akan tampak kosong SELAMANYA di layar (baru pulih kalau halaman di-reload
 * penuh), walau server tetap menyimpan nilai lama. JANGAN menghapus fungsi
 * ini dengan alasan "duplikasi" dari useEffect: keduanya menutup skenario
 * yang berbeda (refresh yang membawa data baru vs. simpan yang tidak
 * mengubah apa pun di server).
 *
 * `serverSnapshot` adalah snapshot server yang diketahui SEBELUM simpan ini
 * (previousGrades.current), dan `savedPayload` adalah hasil
 * `buildGradePayload()` yang barusan benar-benar terkirim dan diterima
 * server (HTTP ok). Menimpa snapshot lama dengan payload itu memberi state
 * yang mencerminkan persis apa yang sekarang tersimpan di server: sel yang
 * baru disimpan menunjukkan nilai barunya, sel yang dikosongkan (tidak ikut
 * di savedPayload) jatuh kembali ke nilai server lama, dan sel yang tidak
 * pernah punya nilai di keduanya tetap tidak muncul sama sekali di hasil
 * (bukan "0" atau "undefined") sehingga `scores[key] ?? ""` di layar tetap
 * merender input kosong.
 */
export function scoresAfterSave({
  serverSnapshot,
  savedPayload,
}: {
  serverSnapshot: Record<string, string>;
  savedPayload: GradePayloadItem[];
}): Record<string, string> {
  const next: Record<string, string> = { ...serverSnapshot };
  for (const item of savedPayload) {
    next[`${item.studentId}:${item.criterionId}`] = String(item.score);
  }
  return next;
}
