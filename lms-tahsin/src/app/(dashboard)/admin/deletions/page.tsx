import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatTanggalWIB } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleName } from "@/generated/prisma/enums";
import { DELETION_STATUS } from "@/lib/account-deletion";
import { DeletionReviewList, type DeletionRow } from "./deletion-review-list";

export const metadata: Metadata = { title: "Permintaan Hapus Akun" };

const STATUS_LABEL: Record<string, string> = {
  awaiting_admin: "Menunggu tinjauan",
  pending: "Disetujui — dalam tenggang",
  executed: "Sudah dihapus",
  cancelled: "Dibatalkan pemohon",
  blocked: "Ditolak",
};

/**
 * Antrean tinjauan permintaan hapus akun (NFR-6, spec §4.7).
 *
 * Menyetujui di sini tidak menghapus apa pun secara langsung — permintaan
 * hanya berpindah ke `pending` dan cron process-deletions yang mengeksekusi
 * setelah tenggang. Satu jalur anonimisasi untuk seluruh sistem.
 */
export default async function AdminDeletionsPage() {
  await requireRole(RoleName.super_admin, RoleName.admin);

  const rows = await prisma.accountDeletionRequest.findMany({
    select: {
      id: true,
      status: true,
      requestedAt: true,
      executeAfter: true,
      requestedBy: true,
      blockedReason: true,
      user: { select: { fullName: true, email: true } },
    },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });

  // Nama pemohon diambil terpisah: requestedBy sengaja bukan relasi, supaya
  // baris permintaan tetap utuh sebagai jejak walau akun pemohonnya sendiri
  // ikut dianonimkan belakangan.
  const requesterIds = [
    ...new Set(rows.map((row) => row.requestedBy).filter((id): id is string => id !== null)),
  ];
  const requesters = requesterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: requesterIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const requesterName = new Map(requesters.map((r) => [r.id, r.fullName]));

  const requests: DeletionRow[] = rows.map((row) => ({
    id: row.id,
    accountName: row.user.fullName,
    accountEmail: row.user.email,
    requestedByLabel: row.requestedBy
      ? (requesterName.get(row.requestedBy) ?? "Pengguna dihapus")
      : "Diri sendiri",
    requestedAtLabel: formatTanggalWIB(row.requestedAt),
    // executeAfter tetap tersimpan setelah permintaan dibatalkan atau ditolak,
    // tapi menampilkannya di sana berbohong: tidak ada yang akan dihapus pada
    // tanggal itu. Hanya relevan untuk yang masih berjalan atau sudah selesai.
    executeAfterLabel:
      row.executeAfter &&
      (row.status === DELETION_STATUS.pending ||
        row.status === DELETION_STATUS.executed)
        ? formatTanggalWIB(row.executeAfter)
        : null,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status] ?? row.status,
    blockedReason: row.blockedReason,
  }));

  const awaiting = requests.filter(
    (r) => r.status === DELETION_STATUS.awaitingAdmin,
  );
  const others = requests.filter(
    (r) => r.status !== DELETION_STATUS.awaitingAdmin,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-plum-800">
          Permintaan hapus akun
        </h1>
        <p className="mt-1 text-sm text-plum-600">
          Menyetujui memulai masa tenggang 7 hari. Penghapusan dijalankan cron
          setelah tenggang berakhir, dan catatan keuangan tetap disimpan tanpa
          nama.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Menunggu tinjauan ({awaiting.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {awaiting.length === 0 ? (
            <p className="text-sm text-plum-600">
              Tidak ada permintaan yang menunggu.
            </p>
          ) : (
            <DeletionReviewList rows={awaiting} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat</CardTitle>
        </CardHeader>
        <CardContent>
          {others.length === 0 ? (
            <p className="text-sm text-plum-600">Belum ada riwayat.</p>
          ) : (
            <DeletionReviewList rows={others} readOnly />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
