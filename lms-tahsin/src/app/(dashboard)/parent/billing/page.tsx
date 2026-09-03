import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalWIB } from "@/lib/datetime";
import {
  INVOICE_LIST_SELECT,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_VARIANT,
  isPayable,
} from "@/lib/invoices";
import { viewableStudentIds } from "@/lib/students";
import { RoleName } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Tagihan" };

/**
 * Dashboard tagihan orang tua (roadmap item 25, PRD F-5).
 *
 * Tagihan yang masih harus dibayar dipisahkan dari riwayat, karena
 * pertanyaan pertama orang tua selalu "berapa yang harus saya bayar
 * sekarang", bukan "apa saja yang pernah saya bayar".
 */
export default async function ParentBillingPage() {
  const user = await requireRole(RoleName.parent, RoleName.student);
  const studentIds = await viewableStudentIds(user);

  const invoices =
    studentIds.length > 0
      ? await prisma.invoice.findMany({
          where: { studentId: { in: studentIds } },
          select: INVOICE_LIST_SELECT,
          orderBy: { issueDate: "desc" },
          take: 50,
        })
      : [];

  const outstanding = invoices.filter((invoice) => isPayable(invoice.status));
  const history = invoices.filter((invoice) => !isPayable(invoice.status));

  const totalOutstanding = outstanding.reduce(
    (sum, invoice) => sum + Number(invoice.total),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Tagihan
        </h1>
        <p className="text-sm text-plum-500">
          Tagihan sesi privat, rincian per pertemuan, dan cara membayarnya.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Belum dibayar
            {outstanding.length > 0 ? ` — ${formatRupiah(totalOutstanding)}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {outstanding.length === 0 ? (
            <p className="text-sm text-plum-500">
              Tidak ada tagihan yang menunggu pembayaran.
            </p>
          ) : (
            <ul className="space-y-3">
              {outstanding.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-plum-800">
                        {invoice.invoiceNumber}
                      </p>
                      <Badge variant={INVOICE_STATUS_VARIANT[invoice.status]}>
                        {INVOICE_STATUS_LABEL[invoice.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-plum-500">
                      {invoice.student.fullName} · {invoice._count.items} sesi ·
                      jatuh tempo {formatTanggalWIB(invoice.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-heading text-lg font-semibold text-plum-800">
                      {formatRupiah(Number(invoice.total))}
                    </p>
                    <Button
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/parent/billing/${invoice.id}`} />}
                    >
                      Bayar
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-plum-500">Belum ada riwayat tagihan.</p>
          ) : (
            <ul className="space-y-3">
              {history.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-plum-800">
                        {invoice.invoiceNumber}
                      </p>
                      <Badge variant={INVOICE_STATUS_VARIANT[invoice.status]}>
                        {INVOICE_STATUS_LABEL[invoice.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-plum-500">
                      {invoice.student.fullName} ·{" "}
                      {invoice.paidAt
                        ? `lunas ${formatTanggalWIB(invoice.paidAt)}`
                        : `terbit ${formatTanggalWIB(invoice.issueDate)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-plum-700">
                      {formatRupiah(Number(invoice.total))}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/parent/billing/${invoice.id}`} />}
                    >
                      Rincian
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
