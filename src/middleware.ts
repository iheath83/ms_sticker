import { NextRequest, NextResponse } from "next/server";

// Better-Auth session cookie name (default)
const SESSION_COOKIE = "better-auth.session_token";

/**
 * Verify the session against the Better-Auth API and return the user's role.
 * Only called for /admin routes (DB-backed role check).
 */
async function getSessionRole(req: NextRequest): Promise<string | null> {
  try {
    const res = await fetch(new URL("/api/auth/get-session", req.url), {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: { role?: string } } | null;
    return data?.user?.role ?? null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  // ── /account/* — requires any authenticated session ──────────────────────
  if (pathname.startsWith("/account")) {
    if (!hasSession) {
      const url = new URL("/login", req.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  // ── /admin/* — requires admin role (verified via Better-Auth API) ─────────
  if (pathname.startsWith("/admin")) {
    if (!hasSession) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    const role = await getSessionRole(req);
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
  ],
};
