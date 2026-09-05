import type { Metadata } from "next";
import { hasRole, requireRole } from "@/lib/auth-guard";
import { RoleName } from "@/generated/prisma/enums";
import { formatTanggalWIB } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activeRequestFor, linkedChildren } from "@/lib/deletion-requests";
import { ExportDataButton } from "./export-data-button";
import { DeletionActions, type ChildRow } from "./deletion-actions";

export const metadata: Metadata = { title: "Data & Akun Saya" };

/**
 * Halaman hak atas data pribadi (NFR-6, UU PDP).
 *
 * Endpoint ekspor dan hapus akun sudah ada sejak Rilis A; halaman inilah yang
 * membuat keduanya benar-benar bisa dipakai keluarga sendiri, bukan hanya
 * lewat permintaan manual ke admin.
 */
export default async function ParentAccountPage() {
  const user = await requireRole(RoleName.parent, RoleName.student);

  const [ownRequest, children] = await Promise.all([
    activeRequestFor(user.id),
    hasRole(user, RoleName.parent) ? linkedChildren(user.id) : Promise.resolve([]),
  ]);

  const childRows: ChildRow[] = await Promise.all(
    children.map(async (child) => {
      const request = await activeRequestFor(child.id);
      return {
        id: child.id,
        fullName: child.fullName,
        status: request?.status ?? null,
        executeAfterLabel: request?.executeAfter
          ? formatTanggalWIB(request.executeAfter)
          : null,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-plum-800">
          Data &amp; akun saya
        </h1>
        <p className="mt-1 text-sm text-plum-600">
          Unduh salinan data Anda, atau ajukan penghapusan akun.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unduh data saya</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-plum-600">
            Berisi profil, riwayat sesi, nilai, catatan guru, tagihan, dan
            pembayaran Anda dalam satu berkas JSON. Dibuat saat diminta dan
            tidak disimpan di server.
          </p>
          <ExportDataButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hapus akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-plum-600">
            Identitas dihapus dari sistem setelah masa tenggang 7 hari. Catatan
            keuangan (tagihan dan pembayaran) tetap tersimpan tanpa nama, karena
            lembaga wajib menjaga pembukuannya. Permintaan bisa dibatalkan
            selama masa tenggang belum berakhir.
          </p>
          <DeletionActions
            ownStatus={ownRequest?.status ?? null}
            ownExecuteAfterLabel={
              ownRequest?.executeAfter
                ? formatTanggalWIB(ownRequest.executeAfter)
                : null
            }
            childRows={childRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}
