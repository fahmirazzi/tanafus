"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BillingPreference, Gender } from "@/generated/prisma/enums";
import { BILLING_LABEL, GENDER_LABEL } from "@/lib/labels";
import { FieldError } from "@/components/form-feedback";

/** Semua field disimpan sebagai string supaya cocok dengan input HTML. */
export type ProfileValues = {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  birthDate: string;
  address: string;
  billingPreference: string;
};

export const emptyProfile: ProfileValues = {
  fullName: "",
  email: "",
  phone: "",
  gender: "",
  birthDate: "",
  address: "",
  billingPreference: BillingPreference.per_session,
};

/** Grup field profil yang identik antara form tambah dan form ubah pengguna. */
export function ProfileFields({
  values,
  errors,
  onChange,
}: {
  values: ProfileValues;
  errors: Record<string, string>;
  onChange: (patch: Partial<ProfileValues>) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="fullName">Nama lengkap</Label>
        <Input
          id="fullName"
          value={values.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? "fullName-error" : undefined}
          required
        />
        <FieldError id="fullName-error" message={errors.fullName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          value={values.email}
          onChange={(e) => onChange({ email: e.target.value })}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        <FieldError id="email-error" message={errors.email} />
        <p className="text-xs text-plum-500">
          Wajib untuk semua role kecuali murid — email dipakai untuk login.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Nomor HP</Label>
        <Input
          id="phone"
          inputMode="tel"
          value={values.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "phone-error" : undefined}
        />
        <FieldError id="phone-error" message={errors.phone} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gender">Jenis kelamin</Label>
        <Select
          value={values.gender}
          onValueChange={(value) => onChange({ gender: value ?? "" })}
        >
          <SelectTrigger id="gender" className="w-full">
            <SelectValue placeholder="Pilih">
              {(value: string | null) =>
                value ? GENDER_LABEL[value as Gender] : "Pilih"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.values(Gender).map((g) => (
              <SelectItem key={g} value={g}>
                {GENDER_LABEL[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthDate">Tanggal lahir</Label>
        <Input
          id="birthDate"
          type="date"
          value={values.birthDate}
          onChange={(e) => onChange({ birthDate: e.target.value })}
          aria-invalid={Boolean(errors.birthDate)}
          aria-describedby={errors.birthDate ? "birthDate-error" : undefined}
        />
        <FieldError id="birthDate-error" message={errors.birthDate} />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="address">Alamat</Label>
        <Textarea
          id="address"
          rows={2}
          value={values.address}
          onChange={(e) => onChange({ address: e.target.value })}
          aria-invalid={Boolean(errors.address)}
          aria-describedby={errors.address ? "address-error" : undefined}
        />
        <FieldError id="address-error" message={errors.address} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="billingPreference">Preferensi tagihan</Label>
        <Select
          value={values.billingPreference}
          onValueChange={(value) =>
            onChange({ billingPreference: value ?? BillingPreference.per_session })
          }
        >
          <SelectTrigger id="billingPreference" className="w-full">
            <SelectValue placeholder="Pilih">
              {(value: string | null) =>
                value ? BILLING_LABEL[value as BillingPreference] : "Pilih"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.values(BillingPreference).map((b) => (
              <SelectItem key={b} value={b}>
                {BILLING_LABEL[b]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-plum-500">Hanya berlaku untuk murid privat.</p>
      </div>
    </div>
  );
}
