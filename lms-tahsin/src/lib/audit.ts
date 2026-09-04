import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Jejak audit untuk perubahan status keuangan (BR-10.4): siapa, kapan,
 * nilai lama, nilai baru. Dipanggil di dalam transaksi yang sama dengan
 * perubahannya, sehingga catatan dan kenyataannya tidak pernah berbeda.
 */
export async function writeAudit(
  client: Client,
  entry: {
    actorId: string;
    entity: string;
    entityId: string;
    action: string;
    oldData?: Prisma.InputJsonValue;
    newData?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      oldData: entry.oldData,
      newData: entry.newData,
    },
  });
}
