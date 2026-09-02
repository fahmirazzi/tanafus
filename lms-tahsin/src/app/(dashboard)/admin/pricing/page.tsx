import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { RoleName } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierManager, type Tier } from "./tier-manager";
import { CustomRateManager } from "./custom-rate-manager";

export const metadata: Metadata = { title: "Kelola Tarif" };

export default async function PricingPage() {
  await requireRole(RoleName.super_admin, RoleName.admin);

  const rows = await prisma.pricingTier.findMany({
    orderBy: { durationMinutes: "asc" },
  });

  // Decimal Prisma tidak bisa menyeberang ke client component apa adanya.
  const tiers: Tier[] = rows.map((t) => ({
    id: t.id,
    durationMinutes: t.durationMinutes,
    price: Number(t.price),
    isActive: t.isActive,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Kelola tarif
        </h1>
        <p className="text-sm text-plum-500">
          Tarif privat dihitung per durasi sesi, bukan tarif flat.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarif standar per durasi</CardTitle>
        </CardHeader>
        <CardContent>
          <TierManager tiers={tiers} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarif khusus murid</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomRateManager tiers={tiers} />
        </CardContent>
      </Card>
    </div>
  );
}
