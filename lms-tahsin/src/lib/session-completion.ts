import { writeAudit } from "@/lib/audit";
import { createsCharge, createsEarning } from "@/lib/regular-sessions";
import { SessionType, type SessionStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Efek samping keuangan saat sesi berpindah status.
 *
 * Diekstrak dari route status ketika kelas reguler tiba: route-nya sudah 250
 * baris, dan reguler menambahkan cabang kedua yang aturannya berbeda —
 * membayar guru TANPA menagih murid (BR-05.5).
 *
 * Menyentuh DB lewat `tx` yang diberikan pemanggil, jadi tidak diuji unit;
 * aturan yang menentukan cabangnya ada di regular-sessions.ts yang murni
 * (createsCharge, createsEarning). Modul ini sendiri hanya menuliskan efeknya
 * dengan jumlah yang SUDAH dihitung pemanggil — perhitungan tarif privat
 * (customRate/tier/revenue share) TETAP di route: kegagalannya (tarif belum
 * ada) harus menolak permintaan SEBELUM transaksi dibuka, bukan membatalkan
 * transaksi yang sudah menulis status sesi.
 */
export type CompletionInput = {
  sessionId: string;
  type: SessionType;
  nextStatus: SessionStatus;
  actorId: string;
  /** Privat saja: pemilik charge. */
  studentId: string | null;
  durationMinutes: number;
  /** Guru yang benar-benar mengajar — pengganti bila ada (BR-04.4). */
  earnerId: string;
  /** Privat saja: harga hasil resolveSessionAmount, sudah di-snapshot pemanggil. */
  chargeAmount: number | null;
  /** Privat: hasil computeEarning. Reguler: honorPerSession class group (BR-05.5). */
  earningAmount: number;
};

export type CompletionResult = {
  chargeCreated: boolean;
  earningCreated: boolean;
  chargeAmount: number;
  earningAmount: number;
};

export async function applyCompletionEffects(
  tx: Prisma.TransactionClient,
  input: CompletionInput,
): Promise<CompletionResult> {
  const chargeAmount = input.chargeAmount ?? 0;
  let chargeCreated = false;
  let earningCreated = false;

  if (createsCharge(input.type, input.nextStatus)) {
    const charge = await tx.sessionCharge.createMany({
      data: [
        {
          sessionId: input.sessionId,
          studentId: input.studentId as string,
          durationMinutes: input.durationMinutes,
          amount: chargeAmount,
        },
      ],
      skipDuplicates: true,
    });
    chargeCreated = charge.count > 0;

    if (chargeCreated) {
      await writeAudit(tx, {
        actorId: input.actorId,
        entity: "SessionCharge",
        entityId: input.sessionId,
        action: "create",
        newData: {
          amount: chargeAmount,
          durationMinutes: input.durationMinutes,
          studentId: input.studentId,
        },
      });
    }
  }

  if (createsEarning(input.type, input.nextStatus)) {
    const earning = await tx.sessionEarning.createMany({
      data: [
        {
          sessionId: input.sessionId,
          teacherId: input.earnerId,
          amount: input.earningAmount,
        },
      ],
      skipDuplicates: true,
    });
    earningCreated = earning.count > 0;

    if (earningCreated) {
      await writeAudit(tx, {
        actorId: input.actorId,
        entity: "SessionEarning",
        entityId: input.sessionId,
        action: "create",
        newData: { amount: input.earningAmount, teacherId: input.earnerId },
      });
    }
  }

  return { chargeCreated, earningCreated, chargeAmount, earningAmount: input.earningAmount };
}
