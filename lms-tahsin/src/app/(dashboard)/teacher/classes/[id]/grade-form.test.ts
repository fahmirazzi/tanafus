import { describe, expect, it } from "vitest";
import { buildGradePayload, mergeServerGrades } from "./grade-form";

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
