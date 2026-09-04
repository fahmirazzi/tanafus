import Link from "next/link";
import { buildPageHref } from "@/lib/pagination-nav";
import { Button } from "@/components/ui/button";

interface PaginationNavProps {
  /** Path halaman saat ini, tanpa query string. */
  pathname: string;
  /** Filter/query yang sedang aktif, TANPA "page" — dipertahankan saat pindah halaman. */
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}

/**
 * Navigasi pagination dipakai bersama oleh halaman riwayat sesi, daftar murid,
 * dan daftar pengguna (NFR-1) — supaya markup-nya tidak disalin tiga kali.
 * Saat di halaman pertama/terakhir, tombol terkait dinonaktifkan (dirender
 * sebagai tombol disabled, bukan tautan) supaya tidak bisa diklik ke halaman
 * yang tidak ada.
 */
export function PaginationNav({
  pathname,
  params,
  page,
  totalPages,
}: PaginationNavProps) {
  // Hanya satu halaman (atau kurang) — tidak ada gunanya menampilkan nav
  // dengan dua tombol nonaktif dan "Halaman 1 dari 1".
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm text-plum-500">
      <span>
        Halaman {page} dari {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={buildPageHref(pathname, params, page - 1)} />}
          >
            Sebelumnya
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Sebelumnya
          </Button>
        )}
        {page < totalPages ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={buildPageHref(pathname, params, page + 1)} />}
          >
            Berikutnya
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Berikutnya
          </Button>
        )}
      </div>
    </div>
  );
}
