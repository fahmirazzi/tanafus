import {
  BillingPreference,
  Gender,
  Relation,
  RoleName,
} from "@/generated/prisma/enums";

/** Label bahasa Indonesia untuk enum schema — dipakai di seluruh UI. */

export const ROLE_LABEL: Record<RoleName, string> = {
  [RoleName.super_admin]: "Super Admin",
  [RoleName.admin]: "Admin",
  [RoleName.teacher]: "Guru",
  [RoleName.student]: "Murid",
  [RoleName.parent]: "Orang Tua",
};

export const RELATION_LABEL: Record<Relation, string> = {
  [Relation.father]: "Ayah",
  [Relation.mother]: "Ibu",
  [Relation.guardian]: "Wali",
};

export const GENDER_LABEL: Record<Gender, string> = {
  [Gender.male]: "Laki-laki",
  [Gender.female]: "Perempuan",
};

export const BILLING_LABEL: Record<BillingPreference, string> = {
  [BillingPreference.per_session]: "Per sesi",
  [BillingPreference.monthly_bundle]: "Bulanan",
};
