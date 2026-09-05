import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { homeForRoles, rolesInclude } from "@/lib/roles";
import { RoleName } from "@/generated/prisma/enums";
import { rateLimitKey, rateLimitRuleFor } from "@/lib/rate-limit";
import { checkRateLimit } from "@/lib/rate-limit-client";

const { auth } = NextAuth(authConfig);

/** Guard per prefix URL — sumber kebenaran: docs/02. */
const PROTECTED_ROUTES: ReadonlyArray<{
  prefix: string;
  roles: readonly RoleName[];
}> = [
  { prefix: "/admin", roles: [RoleName.super_admin, RoleName.admin] },
  { prefix: "/teacher", roles: [RoleName.teacher] },
  { prefix: "/parent", roles: [RoleName.parent, RoleName.student] },
];

/** Halaman yang cukup butuh login; semua peran boleh membukanya. */
const AUTHENTICATED_ROUTES = ["/notifications"];

const AUTH_PAGES = ["/login", "/register"];

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // NFR-2: batasi laju sebelum guard role, supaya percobaan brute force
  // tidak ikut membebani query role di bawah.
  const limitRule = rateLimitRuleFor(pathname);
  if (limitRule) {
    // Ambil entri PERTAMA x-forwarded-for sebagai IP klien. Ini valid HANYA
    // karena aplikasi ini berjalan di belakang edge Vercel, yang menimpa
    // header masuk dan menaruh IP klien terverifikasi di posisi pertama
    // sebelum meneruskan ke fungsi ini — jadi entri pertama tidak bisa
    // dipalsukan oleh klien. Di belakang proxy lain (atau proxy tambahan),
    // entri pertama bisa disisipkan klien sendiri dan jadi rawan spoofing.
    const key = rateLimitKey(limitRule, {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userId: req.auth?.user?.id ?? null,
    });
    if (key && !(await checkRateLimit(key, limitRule))) {
      return NextResponse.json(
        { ok: false, error: "Terlalu banyak permintaan. Coba lagi sebentar." },
        { status: 429 },
      );
    }
  }

  const roles = req.auth?.user?.roles ?? [];
  const isLoggedIn = Boolean(req.auth?.user?.id);

  // Sudah login tapi membuka halaman login/register -> lempar ke dashboard.
  if (isLoggedIn && AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL(homeForRoles(roles), req.nextUrl));
  }

  const needsLoginOnly = AUTHENTICATED_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (needsLoginOnly) {
    if (isLoggedIn) return NextResponse.next();
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const rule = PROTECTED_ROUTES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  if (!rule) return NextResponse.next();

  // Belum login -> ke halaman login, simpan tujuan awal.
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Login tapi role tidak cocok -> 403 (bukan redirect diam-diam).
  if (!rolesInclude(roles, rule.roles)) {
    return NextResponse.rewrite(new URL("/403", req.nextUrl), { status: 403 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/api/:path*",
    "/admin/:path*",
    "/teacher/:path*",
    "/parent/:path*",
    "/notifications/:path*",
    "/login",
    "/register",
  ],
};
