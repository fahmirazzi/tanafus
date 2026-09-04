import { describe, expect, it } from "vitest";
import { buildPageHref, totalPages } from "@/lib/pagination-nav";

describe("buildPageHref", () => {
  it("menambahkan page pada path tanpa query", () => {
    expect(buildPageHref("/teacher/sessions", {}, 2)).toBe(
      "/teacher/sessions?page=2",
    );
  });

  it("MEMPERTAHANKAN filter yang sedang aktif", () => {
    expect(
      buildPageHref("/admin/users", { role: "teacher", q: "abdur" }, 3),
    ).toBe("/admin/users?role=teacher&q=abdur&page=3");
  });

  it("menimpa page lama, bukan menumpuknya", () => {
    expect(buildPageHref("/admin/users", { page: "5", role: "admin" }, 2)).toBe(
      "/admin/users?role=admin&page=2",
    );
  });

  it("mengabaikan nilai kosong supaya URL tidak berisi parameter hampa", () => {
    expect(buildPageHref("/teacher/sessions", { status: "" }, 2)).toBe(
      "/teacher/sessions?page=2",
    );
  });

  it("halaman pertama tetap menulis page=1 secara eksplisit agar tombol Sebelumnya stabil", () => {
    expect(buildPageHref("/teacher/sessions", {}, 1)).toBe(
      "/teacher/sessions?page=1",
    );
  });
});

describe("totalPages", () => {
  it("membulatkan ke atas", () => {
    expect(totalPages(41, 20)).toBe(3);
  });

  it("nol baris tetap satu halaman — daftar kosong bukan nol halaman", () => {
    expect(totalPages(0, 20)).toBe(1);
  });

  it("tepat kelipatan tidak menambah halaman kosong di ujung", () => {
    expect(totalPages(40, 20)).toBe(2);
  });
});
