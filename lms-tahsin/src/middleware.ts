import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { homeForRoles, rolesInclude } from "@/lib/roles";
import { RoleName } from "@/generated/prisma/enums";

const { auth } = NextAuth(authConfig);

/** Guard per prefix URL — sumber kebenaran: docs/02. */
const PROTECTED_ROUTES: ReadonlyArray<{
  prefix: string;
  roles: readonly RoleName[];
}> = [
  { prefix: "/admin", roles: [RoleName.super_admin, RoleName.admin] },
  { prefix: "/guru", roles: [RoleName.teacher] },
  { prefix: "/orangtua", roles: [RoleName.parent, RoleName.student] },
];

const AUTH_PAGES = ["/login", "/register"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const roles = req.auth?.user?.roles ?? [];
  const isLoggedIn = Boolean(req.auth?.user?.id);

  // Sudah login tapi membuka halaman login/register -> lempar ke dashboard.
  if (isLoggedIn && AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL(homeForRoles(roles), req.nextUrl));
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
    "/admin/:path*",
    "/guru/:path*",
    "/orangtua/:path*",
    "/login",
    "/register",
  ],
};
