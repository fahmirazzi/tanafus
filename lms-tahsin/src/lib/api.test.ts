import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePagination,
  toPrismaPagination,
} from "@/lib/api";

function url(query: string): URL {
  return new URL(`https://app.test/api/x${query}`);
}

describe("parsePagination", () => {
  it("memakai default ketika query kosong (NFR-1: default 20)", () => {
    expect(parsePagination(url(""))).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("membaca page dan pageSize yang valid", () => {
    expect(parsePagination(url("?page=3&pageSize=50"))).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it("jatuh ke default ketika pageSize melebihi batas maksimum", () => {
    expect(parsePagination(url(`?pageSize=${MAX_PAGE_SIZE + 1}`))).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("jatuh ke default ketika page bukan angka", () => {
    expect(parsePagination(url("?page=abc"))).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("jatuh ke default ketika page nol atau negatif", () => {
    expect(parsePagination(url("?page=0"))).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });
});

describe("toPrismaPagination", () => {
  it("halaman pertama tidak melewatkan baris", () => {
    expect(toPrismaPagination({ page: 1, pageSize: 20 })).toEqual({
      skip: 0,
      take: 20,
    });
  });

  it("halaman ketiga melewatkan dua halaman penuh", () => {
    expect(toPrismaPagination({ page: 3, pageSize: 20 })).toEqual({
      skip: 40,
      take: 20,
    });
  });
});
