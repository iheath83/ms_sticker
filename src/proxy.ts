import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie, getCookieCache } from "better-auth/cookies";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/account", "/admin"];

// Routes that require admin role
const ADMIN_PREFIXES = ["/admin"];

// Routes only accessible to unauthenticated users
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

// Paths exempt from maintenance mode
const MAINTENANCE_EXEMPT = ["/maintenance", "/admin", "/api/", "/_next/", "/favicon", "/robots", "/sitemap"];
const BYPASS_COOKIE = "ms_admin_bypass";

async function checkMaintenance(request: NextRequest): Promise<boolean> {
  const { pathname } = request.nextUrl;
  if (MAINTENANCE_EXEMPT.some((p) => pathname.startsWith(p))) return false;
  if (request.cookies.get(BYPASS_COOKIE)) return false;
  try {
    const res = await fetch(`${request.nextUrl.origin}/api/maintenance`, {
      headers: { "x-internal": "1" },
    });
    const json = (await res.json()) as { maintenanceEnabled?: boolean };
    return json.maintenanceEnabled === true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Maintenance mode ───────────────────────────────────────────────────────
  const inMaintenance = await checkMaintenance(request);
  if (inMaintenance) {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.rewrite(url);
  }

  // ── Auth guards ───────────────────────────────────────────────────────────
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));
  const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  if (!isProtected && !isAuthRoute) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && sessionCookie) {
    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") ?? "/account";
    return NextResponse.redirect(new URL(callbackUrl, request.url));
  }

  if (isAdminRoute && sessionCookie) {
    const cached = await getCookieCache(request);
    if (cached) {
      const role = (cached.user as { role?: string }).role;
      if (role !== "admin") {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
