import type { Metadata } from "next";
import { Download, FileSpreadsheet } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/currency";
import { summarizeRevenue } from "@/lib/reports";
import { zonedDateKey, zonedDateTimeToUtc } from "@/lib/sessions";
import { RoleName, SessionType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Laporan" };

/** Senin pertama... bukan, cukup tanggal 1 bulan berjalan dalam kalender WIB. */
function startOfMonthKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

/**
 * Laporan sesi & pendapatan (roadmap item 28, PRD F-8).
 *
 * Ringkasan bulan berjalan ditampilkan sebagai pratinjau supaya admin tahu
 * kira-kira apa yang akan diunduh sebelum benar-benar mengunduhnya. Formnya
 * murni HTML method="GET" langsung ke endpoint CSV — tidak ada JavaScript
 * perantara, browser menangani unduhannya sendiri.
 */
export default async function AdminReportsPage() {
  await requireRole(RoleName.super_admin, RoleName.admin);

  const todayKey = zonedDateKey(new Date());
  const fromKey = startOfMonthKey(todayKey);

  const gte = zonedDateTimeToUtc(fromKey, "00:00");
  const lt = new Date(zonedDateTimeToUtc(todayKey, "00:00").getTime() + 86_400_000);

  const sessions = await prisma.session.findMany({
    where: { type: SessionType.private, scheduledAt: { gte, lt } },
    select: {
      charge: { select: { amount: true } },
      earning: { select: { amount: true } },
    },
  });

  const totals = summarizeRevenue(
    sessions.map((session) => ({
      chargeAmount: session.charge ? Number(session.charge.amount) : null,
      earningAmount: session.earning ? Number(session.earning.amount) : null,
    })),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Laporan
        </h1>
        <p className="text-sm text-plum-500">
          Unduh rincian sesi dan pendapatan sebagai CSV untuk periode
          tertentu — dasar pencatatan pendapatan lembaga.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Bulan berjalan ({sessions.length} sesi)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-plum-500">Sesi tertagih</p>
            <p className="font-heading text-xl font-semibold text-plum-800">
              {totals.billableCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-plum-500">Total tagihan</p>
            <p className="font-heading text-xl font-semibold text-plum-800">
              {formatRupiah(totals.totalCharge)}
            </p>
          </div>
          <div>
            <p className="text-xs text-plum-500">Total upah guru</p>
            <p className="font-heading text-xl font-semibold text-plum-800">
              {formatRupiah(totals.totalEarning)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="size-4" />
              Unduh CSV sesi &amp; pendapatan
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            method="GET"
            action="/api/reports/sessions"
            className="grid gap-4 sm:grid-cols-3 sm:items-end"
          >
            <div className="space-y-2">
              <Label htmlFor="from">Dari tanggal</Label>
              <Input id="from" name="from" type="date" defaultValue={fromKey} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Sampai tanggal</Label>
              <Input id="to" name="to" type="date" defaultValue={todayKey} required />
            </div>
            <Button type="submit">
              <Download data-icon="inline-start" />
              Unduh CSV
            </Button>
          </form>
          <p className="pt-3 text-xs text-plum-500">
            Berisi semua sesi privat dalam rentang tanggal terpilih: guru,
            murid, durasi, status, tagihan, dan upah guru per sesi. Rentang
            maksimal 366 hari sekali unduh.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
