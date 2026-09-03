import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { guardPageAccess } from "@/lib/page-guard";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalWIB } from "@/lib/datetime";
import {
  INVOICE_DETAIL_SELECT,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_VARIANT,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_VARIANT,
  isPayable,
} from "@/lib/invoices";
import { midtransConfig, snapScriptUrl } from "@/lib/midtrans";
import { PaymentStatus, RoleName } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayPanel } from "./pay-panel";

export const metadata: Metadata = { title: "Rincian Tagihan" };

type PageProps = { params: Promise<{ id: string }> };

export default async function ParentInvoiceDetailPage({ params }: PageProps) {
  const user = await requireRole(RoleName.parent, RoleName.student);
  const { id } = await params;

  await guardPageAccess(user, { kind: "invoice", invoiceId: id });

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: INVOICE_DETAIL_SELECT,
  });
  if (!invoice) notFound();

  const verifiedTotal = invoice.payments
    .filter((payment) => payment.status === PaymentStatus.verified)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const outstanding = Number(invoice.total) - verifiedTotal;

  const config = midtransConfig();

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href="/parent/billing" />}
      >
        <ArrowLeft data-icon="inline-start" />
        Semua tagihan
      </Button>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            {invoice.invoiceNumber}
          </h1>
          <Badge variant={INVOICE_STATUS_VARIANT[invoice.status]}>
            {INVOICE_STATUS_LABEL[invoice.status]}
          </Badge>
        </div>
        <p className="text-sm text-plum-500">
          {invoice.student.fullName} · terbit{" "}
          {formatTanggalWIB(invoice.issueDate)} · jatuh tempo{" "}
          {formatTanggalWIB(invoice.dueDate)}
        </p>
      </div>

      {invoice.voidReason ? (
        <Card>
          <CardContent className="py-4 text-sm text-plum-700">
            Tagihan ini dibatalkan lembaga dan tidak perlu dibayar. Alasan:{" "}
            {invoice.voidReason}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rincian sesi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="divide-y divide-border">
            {invoice.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-plum-700">{item.description}</span>
                <span className="text-plum-800">
                  {formatRupiah(Number(item.amount))}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="font-medium text-plum-800">Total</span>
            <span className="font-heading text-lg font-semibold text-plum-800">
              {formatRupiah(Number(invoice.total))}
            </span>
          </div>

          {verifiedTotal > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-plum-500">Sudah dibayar</span>
              <span className="text-plum-700">
                {formatRupiah(verifiedTotal)}
              </span>
            </div>
          ) : null}

          {isPayable(invoice.status) ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-plum-500">Sisa</span>
              <span className="font-medium text-plum-800">
                {formatRupiah(outstanding)}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {invoice.payments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat pembayaran</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {invoice.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm text-plum-800">
                      {formatRupiah(Number(payment.amount))} ·{" "}
                      {PAYMENT_METHOD_LABEL[payment.method]}
                    </p>
                    <p className="text-xs text-plum-500">
                      Dikirim {formatTanggalWIB(payment.createdAt)}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </p>
                    {payment.note ? (
                      <p className="text-xs text-plum-700">{payment.note}</p>
                    ) : null}
                  </div>
                  <Badge variant={PAYMENT_STATUS_VARIANT[payment.status]}>
                    {PAYMENT_STATUS_LABEL[payment.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {isPayable(invoice.status) && outstanding > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bayar tagihan ini</CardTitle>
          </CardHeader>
          <CardContent>
            <PayPanel
              invoiceId={invoice.id}
              outstanding={outstanding}
              snapEnabled={config !== null}
              snapScriptSrc={snapScriptUrl(config?.isProduction ?? false)}
              snapClientKey={config?.clientKey ?? ""}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
