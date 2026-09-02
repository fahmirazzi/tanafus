import type { DefaultSession } from "next-auth";
import type { RoleName } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: RoleName[];
    } & DefaultSession["user"];
  }

  interface User {
    roles: RoleName[];
  }
}

/**
 * next-auth/jwt hanya me-re-export @auth/core/jwt, sehingga augmentasi
 * WAJIB menyasar modul aslinya agar interface JWT benar-benar ter-merge.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    roles: RoleName[];
  }
}

export {};
