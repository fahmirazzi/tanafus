import { describe, expect, it } from "vitest";
import { buildGradePayload, mergeServerGrades, scoresAfterSave } from "./grade-form";

describe("buildGradePayload", () => {
  it("membuang sel kosong dan sel berisi spasi dari payload", () => {
    // Number("") adalah 0, dan 0 palsu akan merusak rata-rata rapor — sel
    // yang belum diisi guru TIDAK BOLEH dikirim sebagai nilai nol.
    const payload = buildGradePayload({
      "s1:1": "",
      "s2:1": "   ",
      "s3:1": "8",
    });

    expect(payload).toEqual([{ studentId: "s3", criterionId: 1, score: 8 }]);
  });

  it("tetap mengirim sel berisi \"0\" yang sah", () => {
    // Nol adalah nilai valid yang sengaja diisi guru, beda dengan sel kosong.
    const payload = buildGradePayload({ "s1:2": "0" });

    expect(payload).toEqual([{ studentId: "s1", criterionId: 2, score: 0 }]);
  });

  it("memecah kunci studentId:criterionId dan mengonversi angka", () => {
    const payload = buildGradePayload({ "murid-abc:3": "7.5" });

    expect(payload).toEqual([
      { studentId: "murid-abc", criterionId: 3, score: 7.5 },
    ]);
  });
});

describe("mergeServerGrades", () => {
  it("sel yang tidak disunting guru menyerap nilai server yang baru", () => {
    // Guru tidak menyentuh sel ini sejak snapshot terakhir, jadi refresh
    // boleh menimpanya dengan apa pun yang server simpan sekarang.
    const next = mergeServerGrades({
      serverBefore: { "s1:1": "7" },
      local: { "s1:1": "7" },
      serverAfter: { "s1:1": "9" },
    });

    expect(next["s1:1"]).toBe("9");
  });

  it("sel yang sedang disunting guru (belum disimpan) tidak ditimpa nilai server", () => {
    // Guru sudah mengetik "8" tapi belum menekan Simpan — refresh yang
    // dipicu aksi lain (mis. simpan kehadiran) tidak boleh membuang ketikan.
    const next = mergeServerGrades({
      serverBefore: { "s1:1": "7" },
      local: { "s1:1": "8" },
      serverAfter: { "s1:1": "7" },
    });

    expect(next["s1:1"]).toBe("8");
  });

  it("sel yang dikosongkan guru tapi tidak ikut terkirim menampilkan nilai server", () => {
    // saveGrades() dengan sengaja tidak mengirim sel kosong, jadi server
    // masih menyimpan nilai lama. Layar HARUS kembali menunjukkan nilai
    // server itu, bukan mempertahankan pengosongan yang tidak pernah
    // benar-benar disimpan — kalau tidak, guru mengira nilai murid hilang.
    const next = mergeServerGrades({
      serverBefore: { "s1:1": "7" },
      local: { "s1:1": "" },
      serverAfter: { "s1:1": "7" },
    });

    expect(next["s1:1"]).toBe("7");
  });

  it("sel baru yang hanya ada di serverAfter (belum pernah ada di snapshot) ikut muncul", () => {
    const next = mergeServerGrades({
      serverBefore: {},
      local: {},
      serverAfter: { "s2:1": "5" },
    });

    expect(next["s2:1"]).toBe("5");
  });
});

describe("scoresAfterSave", () => {
  // Ini menggantikan ketergantungan pada router.refresh() untuk resinkronisasi
  // setelah SUKSES simpan: kalau guru mengosongkan sel yang sudah tersimpan
  // lalu menekan "Simpan nilai" TANPA mengubah sel lain, server tidak
  // menyimpan apa pun yang baru (buildGradePayload tidak pernah mengirim sel
  // kosong) — jadi payload RSC yang dikirim ulang oleh router.refresh() BENAR
  // identik dengan sebelumnya, React tidak membuat referensi prop `grades`
  // baru, dan useEffect(..., [grades]) tidak pernah menyala. scoresAfterSave
  // menghitung state berikutnya secara lokal, tanpa menunggu refresh sama
  // sekali, sehingga sel yang dikosongkan langsung jatuh kembali ke nilai
  // server yang sebenarnya tersimpan.
  it("sel yang dikosongkan (tidak ada di savedPayload) kembali ke nilai server dari serverSnapshot", () => {
    const next = scoresAfterSave({
      serverSnapshot: { "s1:1": "77" },
      savedPayload: [],
    });

    expect(next["s1:1"]).toBe("77");
  });

  it("sel yang ada di savedPayload menampilkan nilai yang baru saja disimpan", () => {
    const next = scoresAfterSave({
      serverSnapshot: { "s1:1": "77" },
      savedPayload: [{ studentId: "s1", criterionId: 1, score: 9 }],
    });

    expect(next["s1:1"]).toBe("9");
  });

  it("nilai desimal yang baru disimpan dikonversi kembali ke string apa adanya", () => {
    const next = scoresAfterSave({
      serverSnapshot: {},
      savedPayload: [{ studentId: "s1", criterionId: 2, score: 7.5 }],
    });

    expect(next["s1:2"]).toBe("7.5");
  });

  it("sel yang tidak pernah punya nilai (tidak di snapshot maupun payload) tetap kosong", () => {
    // Bukan "0" (Number(undefined) buatan) atau string "undefined" — kuncinya
    // memang tidak boleh ada di hasil, supaya `scores[key] ?? ""` di layar
    // tetap merender input kosong.
    const next = scoresAfterSave({
      serverSnapshot: { "s1:1": "77" },
      savedPayload: [],
    });

    expect(next["s9:9"]).toBeUndefined();
  });
});

/**
 * Komposisi yang dipakai jalur simpan di session-card.tsx.
 *
 * Diuji sebagai komposisi (bukan cuma tiap fungsi sendiri-sendiri) karena bug
 * yang ditutup di sini lahir dari CARA ketiganya dirangkai, bukan dari salah
 * satu fungsi: jalur sukses sempat memakai `setScores(nilai biasa)` yang
 * mengganti SELURUH state, sehingga sel yang diketik guru selagi request
 * berjalan hilang diam-diam. Rangkaian di bawah meniru urutan di
 * `saveGrades()`; kalau urutan di komponen berubah, uji ini tidak akan ikut
 * gagal — itu batasnya, dan sengaja tidak ditutup dengan uji DOM baru.
 */
function nextScoresOnSave({
  serverSnapshot,
  savedPayload,
  local,
}: {
  serverSnapshot: Record<string, string>;
  savedPayload: ReturnType<typeof buildGradePayload>;
  local: Record<string, string>;
}): Record<string, string> {
  const serverAfter = scoresAfterSave({ serverSnapshot, savedPayload });
  return mergeServerGrades({ serverBefore: serverSnapshot, local, serverAfter });
}

describe("komposisi jalur simpan (scoresAfterSave + mergeServerGrades)", () => {
  it("sel yang diketik guru SELAGI request berjalan tidak hilang", () => {
    // Input tabel tidak di-disabled saat menyimpan: `payload` ditangkap
    // sebelum fetch, lalu guru mengetik "8" di sel lain sebelum respons tiba.
    // Ketikan itu tidak boleh tertimpa oleh hasil simpan.
    const serverSnapshot = { "s1:1": "77", "s2:1": "5" };
    const next = nextScoresOnSave({
      serverSnapshot,
      savedPayload: buildGradePayload({ "s1:1": "9", "s2:1": "5" }),
      local: { "s1:1": "9", "s2:1": "8" },
    });

    expect(next["s2:1"]).toBe("8");
    expect(next["s1:1"]).toBe("9");
  });

  it("sel yang dikosongkan tetap kembali ke nilai server (bug asli tetap tertutup)", () => {
    // Regresi yang paling mahal: perbaikan untuk ketikan-selagi-menyimpan
    // tidak boleh membuka lagi bug tiga ronde sebelumnya.
    const serverSnapshot = { "s1:1": "77", "s2:1": "5" };
    const next = nextScoresOnSave({
      serverSnapshot,
      savedPayload: buildGradePayload({ "s1:1": "", "s2:1": "5" }),
      local: { "s1:1": "", "s2:1": "5" },
    });

    expect(next["s1:1"]).toBe("77");
  });

  it("sel yang ikut terkirim dan tidak disentuh lagi menampilkan nilai yang baru disimpan", () => {
    const serverSnapshot = { "s1:1": "77" };
    const next = nextScoresOnSave({
      serverSnapshot,
      savedPayload: buildGradePayload({ "s1:1": "9" }),
      local: { "s1:1": "9" },
    });

    expect(next["s1:1"]).toBe("9");
  });

  it("cabang payload kosong memulihkan sel dari snapshot server tanpa request", () => {
    // Guru mengosongkan SATU-SATUNYA sel yang terisi: tidak ada yang dikirim,
    // tapi layar tetap harus menunjukkan apa yang benar-benar tersimpan.
    const serverSnapshot = { "s1:1": "77" };
    const next = mergeServerGrades({
      serverBefore: serverSnapshot,
      local: { "s1:1": "" },
      serverAfter: serverSnapshot,
    });

    expect(next["s1:1"]).toBe("77");
  });
});
