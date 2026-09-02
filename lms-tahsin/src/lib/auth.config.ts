import type { NextAuthConfig } from "next-auth";

/**
 * Konfigurasi yang AMAN dijalankan di Edge runtime (dipakai middleware).
 * Tidak boleh mengimpor Prisma atau bcrypt di sini — keduanya Node-only.
 * Provider Credentials ditambahkan di src/lib/auth.ts.
 */
export const authConfig = {
  session: {
    strategy: "jwt",
    // NFR-2: timeout sesi default 24 jam.
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? "";
        token.roles = user.roles;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.roles = token.roles ?? [];
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
