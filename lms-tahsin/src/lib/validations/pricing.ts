import { z } from "zod";

/**
 * Harga disimpan dalam rupiah penuh (tanpa sen). Kolomnya Decimal(12,2)
 * supaya tetap presisi kalau suatu saat butuh pecahan.
 */
const priceField = z.coerce
  .number({ error: "Harga wajib diisi" })
  .int("Harga harus bilangan bulat rupiah")
  .min(0, "Harga tidak boleh negatif")
  .max(100_000_000, "Harga terlalu besar");

const durationField = z.coerce
  .number({ error: "Durasi wajib diisi" })
  .int("Durasi harus bilangan bulat menit")
  .min(15, "Durasi minimal 15 menit")
  .max(240, "Durasi maksimal 240 menit");

export const createPricingTierSchema = z.object({
  durationMinutes: durationField,
  price: priceField,
});

export type CreatePricingTierInput = z.infer<typeof createPricingTierSchema>;

/**
 * durationMinutes sengaja tidak bisa diubah: durasi adalah identitas tier
 * (unique di DB) dan dipakai sebagai kunci di student_custom_rates. Untuk
 * ganti durasi, nonaktifkan tier lama lalu buat yang baru.
 */
export const updatePricingTierSchema = z
  .object({
    price: priceField.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.price !== undefined || v.isActive !== undefined, {
    message: "Tidak ada perubahan yang dikirim",
  });

/**
 * Bentuk tersimpan: {"30": 50000, "60": 90000} — kunci = durasi menit.
 * Kunci divalidasi ulang di route agar hanya durasi yang punya tier.
 */
export const customRateSchema = z.object({
  customPrice: z
    .record(
      z.string().regex(/^\d+$/, "Durasi tidak valid"),
      priceField,
    )
    .refine((v) => Object.keys(v).length > 0, {
      message: "Minimal satu durasi harus diisi",
    }),
});

export type CustomRateInput = z.infer<typeof customRateSchema>;
