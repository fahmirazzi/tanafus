import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalWIB } from "@/lib/datetime";
import {
  INVOICE_LIST_SELECT,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_VARIANT,
} from "@/lib/invoices";
import {
  InvoiceStatus,
  PaymentStatus,
  RoleName,
} from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tagihan" };

type PageProps = { searchParams: Promise<{ status?: string }> };

const FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "Semua" },
  { value: InvoiceStatus.issued, label: "Menunggu pembayaran" },
  { value: InvoiceStatus.overdue, label: "Terlambat" },
  { value: InvoiceStatus.partial, label: "Dibayar sebagian" },
  { value: InvoiceStatus.paid, label: "Lunas" },
  { value: InvoiceStatus.void, label: "Dibatalkan" },
];

function parseStatus(value: string | undefined): InvoiceStatus | null {
  const match = Object.values(InvoiceStatus).find((s) => s === value);
  return match ?? null;
}

/**
 * Kelola tagihan sisi admin (PRD bagian dashboard admin).
 *
 * Yang ditonjolkan di atas adalah bukti transfer yang menunggu verifikasi,
 * karena hanya itu yang benar-benar menahan pekerjaan orang lain — sisanya
 * bisa dibaca kapan saja.
 */
export default async function AdminInvoicesPage({ searchParams }: PageProps) {
  await requireRole(RoleName.super_admin, RoleName.admin);

  const { status } = await searchParams;
  const filter = parseStatus(status);

  const [pendingPayments, invoices, suspended] = await Promise.all([
    prisma.payment.findMany({
      where: { status: PaymentStatus.pending, proofUrl: { not: null } },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            student: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 30,
    }),
    prisma.invoice.findMany({
      where: filter ? { status: filter } : {},
      select: INVOICE_LIST_SELECT,
      orderBy: { issueDate: "desc" },
      take: 50,
    }),
    prisma.user.findMany({
      where: { NOT: { suspendedAt: null } },
      select: { id: true, fullName: true, suspensionReason: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Tagihan
        </h1>
        <p className="text-sm text-plum-500">
          Verifikasi bukti transfer, pantau tunggakan, dan batalkan tagihan
          yang salah.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Bukti transfer menunggu verifikasi ({pendingPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingPayments.length === 0 ? (
            <p className="text-sm text-plum-500">
              Tidak ada bukti transfer yang menunggu.
            </p>
          ) : (
            <ul className="space-y-3">
              {pendingPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-plum-800">
                      {payment.invoice.invoiceNumber} ·{" "}
                      {formatRupiah(Number(payment.amount))}
                    </p>
                    <p className="text-xs text-plum-500">
                      {payment.invoice.student.fullName} · dikirim{" "}
                      {formatTanggalWIB(payment.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link href={`/admin/invoices/${payment.invoice.id}`} />
                    }
                  >
                    Periksa
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {suspended.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Murid disuspend ({suspended.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {suspended.map((student) => (
                <li key={student.id} className="text-sm text-plum-700">
                  <span className="font-medium text-plum-800">
                    {student.fullName}
                  </span>
                  {student.suspensionReason
                    ? ` — ${student.suspensionReason}`
                    : ""}
                </li>
              ))}
            </ul>
            <p className="pt-3 text-xs text-plum-500">
              Suspensi dicabut dari halaman tagihan murid yang bersangkutan,
              setelah tunggakannya diselesaikan.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Semua tagihan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <nav className="flex flex-wrap gap-2" aria-label="Saring status">
            {FILTERS.map((option) => {
              const active = (status ?? "") === option.value;
              return (
                <Link
                  key={option.label}
                  href={
                    option.value
                      ? `/admin/invoices?status=${option.value}`
                      : "/admin/invoices"
                  }
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-orange-500 text-white"
                      : "bg-cream-100 text-plum-700 hover:bg-cream-100/70",
                  )}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>

          {invoices.length === 0 ? (
            <p className="text-sm text-plum-500">
              Tidak ada tagihan pada saringan ini.
            </p>
          ) : (
            <ul className="space-y-3">
              {invoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
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
                    <p className="text-plum-800">
                      {formatRupiah(Number(invoice.total))}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/admin/invoices/${invoice.id}`} />}
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
