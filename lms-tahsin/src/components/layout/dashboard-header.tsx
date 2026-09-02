import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTanggalWIB } from "@/lib/datetime";
import type { RoleName } from "@/generated/prisma/enums";

/** Placeholder dashboard Fase 0 — dibuang begitu modul asli masuk. */
export function DashboardHeader({
  title,
  subtitle,
  roles,
  note,
}: {
  title: string;
  subtitle: string;
  roles: RoleName[];
  note: string;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-plum-500">{subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-plum-500">Role aktif:</span>
            {roles.map((role) => (
              <Badge key={role} variant="secondary">
                {role}
              </Badge>
            ))}
          </div>
          <p className="text-plum-500">
            Hari ini: {formatTanggalWIB(new Date())} (WIB)
          </p>
          <p className="rounded-md bg-orange-50 px-3 py-2 text-plum-700">
            {note}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
