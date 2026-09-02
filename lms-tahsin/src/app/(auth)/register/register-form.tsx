"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Relation, Gender } from "@/generated/prisma/enums";

type ChildDraft = {
  fullName: string;
  gender: string;
  birthDate: string;
  password: string;
};

const emptyChild: ChildDraft = {
  fullName: "",
  gender: "",
  birthDate: "",
  password: "",
};

const RELATION_LABEL: Record<string, string> = {
  [Relation.father]: "Ayah",
  [Relation.mother]: "Ibu",
  [Relation.guardian]: "Wali",
};

const GENDER_LABEL: Record<string, string> = {
  [Gender.male]: "Laki-laki",
  [Gender.female]: "Perempuan",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function RegisterForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [relation, setRelation] = useState<string>("");
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [children, setChildren] = useState<ChildDraft[]>([{ ...emptyChild }]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateChild(index: number, patch: Partial<ChildDraft>): void {
    setChildren((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setErrors({});
    setLoading(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        phone,
        password,
        confirmPassword,
        relation,
        agreePrivacy,
        children: children.map((c) => ({
          fullName: c.fullName,
          gender: c.gender === "" ? undefined : c.gender,
          birthDate: c.birthDate === "" ? undefined : c.birthDate,
          password: c.password,
        })),
      }),
    });

    const payload: unknown = await response.json();
    setLoading(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      setErrors(body.details ?? {});
      setFormError(body.error ?? "Pendaftaran gagal. Coba lagi.");
      return;
    }

    router.replace("/login?registered=1");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <fieldset className="space-y-4">
        <legend className="pb-2 text-sm font-semibold text-plum-800">
          Data orang tua
        </legend>

        <div className="space-y-2">
          <Label htmlFor="fullName">Nama lengkap</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-invalid={Boolean(errors.fullName)}
            required
          />
          <FieldError id="fullName-error" message={errors.fullName} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            required
          />
          <FieldError id="email-error" message={errors.email} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Nomor HP (opsional)</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={Boolean(errors.phone)}
          />
          <FieldError id="phone-error" message={errors.phone} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="relation">Hubungan dengan anak</Label>
          <Select
            value={relation}
            onValueChange={(value) => setRelation(value ?? "")}
          >
            <SelectTrigger id="relation" aria-invalid={Boolean(errors.relation)}>
              <SelectValue placeholder="Pilih hubungan" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(Relation).map((r) => (
                <SelectItem key={r} value={r}>
                  {RELATION_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="relation-error" message={errors.relation} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Kata sandi</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            required
          />
          <p className="text-xs text-plum-400">Minimal 8 karakter.</p>
          <FieldError id="password-error" message={errors.password} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Ulangi kata sandi</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-invalid={Boolean(errors.confirmPassword)}
            required
          />
          <FieldError
            id="confirmPassword-error"
            message={errors.confirmPassword}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="pb-2 text-sm font-semibold text-plum-800">
          Data anak
        </legend>

        {children.map((child, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-plum-700">
                Anak {index + 1}
              </span>
              {children.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setChildren((prev) => prev.filter((_, i) => i !== index))
                  }
                  aria-label={`Hapus anak ${index + 1}`}
                  className="rounded-md p-1 text-plum-400 hover:bg-cream-100 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`child-name-${index}`}>Nama lengkap anak</Label>
              <Input
                id={`child-name-${index}`}
                value={child.fullName}
                onChange={(e) =>
                  updateChild(index, { fullName: e.target.value })
                }
                aria-invalid={Boolean(errors[`children.${index}.fullName`])}
                required
              />
              <FieldError
                id={`child-name-error-${index}`}
                message={errors[`children.${index}.fullName`]}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`child-gender-${index}`}>Jenis kelamin</Label>
                <Select
                  value={child.gender}
                  onValueChange={(value) =>
                    updateChild(index, { gender: value ?? "" })
                  }
                >
                  <SelectTrigger id={`child-gender-${index}`}>
                    <SelectValue placeholder="Pilih" />
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
                <Label htmlFor={`child-birth-${index}`}>Tanggal lahir</Label>
                <Input
                  id={`child-birth-${index}`}
                  type="date"
                  value={child.birthDate}
                  onChange={(e) =>
                    updateChild(index, { birthDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`child-password-${index}`}>
                Kata sandi anak (opsional)
              </Label>
              <Input
                id={`child-password-${index}`}
                type="password"
                autoComplete="new-password"
                value={child.password}
                onChange={(e) =>
                  updateChild(index, { password: e.target.value })
                }
                aria-invalid={Boolean(errors[`children.${index}.password`])}
              />
              <p className="text-xs text-plum-400">
                Kosongkan jika anak belum perlu akun sendiri. Anda tetap bisa
                memantau lewat akun ini.
              </p>
              <FieldError
                id={`child-password-error-${index}`}
                message={errors[`children.${index}.password`]}
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() => setChildren((prev) => [...prev, { ...emptyChild }])}
          className="w-full"
        >
          <Plus className="size-4" />
          Tambah anak
        </Button>
        <FieldError id="children-error" message={errors.children} />
      </fieldset>

      <div className="flex items-start gap-3">
        <input
          id="agreePrivacy"
          type="checkbox"
          checked={agreePrivacy}
          onChange={(e) => setAgreePrivacy(e.target.checked)}
          className="mt-1 size-4 accent-[var(--brand-orange-500)]"
        />
        <Label
          htmlFor="agreePrivacy"
          className="text-sm font-normal text-plum-600"
        >
          Saya menyetujui kebijakan privasi Tanafus Center dan pengelolaan data
          anak saya sesuai UU PDP.
        </Label>
      </div>
      <FieldError id="agreePrivacy-error" message={errors.agreePrivacy} />

      {formError ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Memproses..." : "Daftar"}
      </Button>
    </form>
  );
}
