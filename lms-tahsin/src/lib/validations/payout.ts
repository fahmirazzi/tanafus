import { z } from "zod";
import { PayoutStatus } from "@/generated/prisma/enums";

/** Masukan modul upah dan payout (roadmap item 26, BR-05). */

const note = z
  .union([
    z.string().trim().max(500, "Catatan maksimal 500 karakter"),
    z.literal(""),
  ])
  .optional();

/**
 * Persetujuan upah oleh admin, bisa massal (BR-05.3).
 *
 * Id yang dikirim dibatasi jumlahnya supaya satu permintaan tidak menahan
 * transaksi database terlalu lama; antrean yang lebih panjang dari ini
 * disetujui dalam beberapa kali tekan.
 */
export const approveEarningsSchema = z.object({
  earningIds: z
    .array(z.uuid("Upah tidak valid"))
    .min(1, "Pilih minimal satu upah")
    .max(200, "Maksimal 200 upah sekali persetujuan"),
});

export type ApproveEarningsInput = z.infer<typeof approveEarningsSchema>;

/** Keputusan admin atas sebuah pengajuan payout. */
export const reviewPayoutSchema = z
  .object({
    action: z.enum(["approve", "reject", "mark_paid"]),
    note,
  })
  .superRefine((value, ctx) => {
    if (value.action === "reject" && !value.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Alasan penolakan wajib diisi",
      });
    }
  });

export type ReviewPayoutInput = z.infer<typeof reviewPayoutSchema>;

export const payoutListQuerySchema = z.object({
  status: z.enum(PayoutStatus).optional(),
  teacherId: z.uuid("Guru tidak valid").optional(),
});
