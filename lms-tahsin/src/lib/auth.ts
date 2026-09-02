import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { loginSchema } from "@/lib/validations/auth";
import type { RoleName } from "@/generated/prisma/enums";

/**
 * Hash pembanding untuk email yang tidak ditemukan, agar waktu respons
 * login mirip antara "email salah" dan "password salah" (anti user-enumeration).
 */
const DUMMY_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata sandi", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            fullName: true,
            email: true,
            photoUrl: true,
            passwordHash: true,
            isActive: true,
            roles: { select: { role: { select: { name: true } } } },
          },
        });

        const isValid = await bcrypt.compare(
          password,
          user?.passwordHash ?? DUMMY_HASH,
        );

        // Akun nonaktif (mis. anak tanpa kredensial) tidak boleh login.
        if (!user || !user.isActive || !isValid) return null;

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          image: user.photoUrl,
          roles: user.roles.map((r) => r.role.name) as RoleName[],
        };
      },
    }),
  ],
});
