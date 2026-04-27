import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie, getCookieCache } from "better-auth/cookies";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/account", "/admin"];

// Routes that require admin role
const ADMIN_PREFIXES = ["/admin"];

// Routes only accessible to unauthenticated users
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));
  const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  // Skip middleware for public routes
  if (!isProtected && !isAuthRoute) {
    return NextResponse.next();
  }

  // Use cookie-based check (no DB call — Edge Runtime compatible)
  // NOTE: not a full security check — actual session validation is done in server actions
  const sessionCookie = getSessionCookie(request);

  // Redirect unauthenticated users trying to access protected routes
  if (isProtected && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages (login/register)
  if (isAuthRoute && sessionCookie) {
    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") ?? "/account";
    return NextResponse.redirect(new URL(callbackUrl, request.url));
  }

  // For admin routes, check role from cookie cache
  if (isAdminRoute && sessionCookie) {
    const cached = await getCookieCache(request);
    if (cached) {
      const role = (cached.user as { role?: string }).role;
      if (role !== "admin") {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    // If no cache yet, let through — server action will validate
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
