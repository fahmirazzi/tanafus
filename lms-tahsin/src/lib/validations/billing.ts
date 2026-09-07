import { z } from "zod";
import { InvoiceStatus } from "@/generated/prisma/enums";

/**
 * Masukan modul tagihan privat (PRD F-5d & F-5e, roadmap item 22-24).
 */

const note = z
  .union([
    z.string().trim().max(500, "Catatan maksimal 500 karakter"),
    z.literal(""),
  ])
  .optional();

/**
 * Bukti transfer manual yang diunggah orang tua.
 *
 * Buktinya berupa tautan yang ditempel, mengikuti pola yang sama dengan
 * audio koreksi pada feedback: penyimpanan berkas belum ada di fase ini.
 * Nilai yang diketik murid TIDAK dipercaya sebagai kebenaran — admin yang
 * mencocokkannya dengan mutasi rekening saat verifikasi.
 */
export const submitTransferProofSchema = z.object({
  amount: z
    .coerce
    .number()
    .int("Nominal harus bilangan bulat rupiah")
    .positive("Nominal harus lebih dari nol")
    .max(1_000_000_000, "Nominal di luar batas wajar"),
  proofUrl: z
    .url("Tautan bukti transfer tidak valid")
    .max(500, "Tautan maksimal 500 karakter"),
  reference: z
    .union([
      z.string().trim().max(100, "Nomor rujukan maksimal 100 karakter"),
      z.literal(""),
    ])
    .optional(),
  note,
});

export type SubmitTransferProofInput = z.infer<typeof submitTransferProofSchema>;

/** Keputusan admin atas sebuah bukti transfer. */
export const verifyPaymentSchema = z
  .object({
    action: z.enum(["verify", "reject"]),
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

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

/** BR-04.7: void selalu punya alasan, karena catatannya tidak dihapus. */
export const voidInvoiceSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Alasan pembatalan wajib diisi")
    .max(500, "Alasan maksimal 500 karakter"),
});

export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;

/** BR-04.6: mencabut suspensi adalah keputusan sadar admin, bukan otomatis. */
export const unsuspendStudentSchema = z.object({
  note,
});

export const invoiceListQuerySchema = z.object({
  status: z.enum(InvoiceStatus).optional(),
  studentId: z.uuid("Murid tidak valid").optional(),
});

/**
 * Konversi charge periode jadi cicilan (BR-04.8). Admin menentukan jumlah
 * dan tanggal tiap cicilan sendiri — bukan pembagian rata otomatis (spec B3
 * §3.2) — jadi tidak ada logika pembulatan sisa di sini; validasi jumlah
 * total terhadap charge asli terjadi di route, bukan di schema, karena
 * butuh data dari database.
 */
export const installmentConversionSchema = z.object({
  installments: z
    .array(
      z.object({
        amount: z.coerce.number().positive("Nominal harus lebih dari nol"),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
      }),
    )
    .min(1, "Minimal satu cicilan"),
});

export type InstallmentConversionInput = z.infer<typeof installmentConversionSchema>;
