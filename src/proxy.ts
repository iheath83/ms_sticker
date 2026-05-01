import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie, getCookieCache } from "better-auth/cookies";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/account", "/admin"];

// Routes that require admin role
const ADMIN_PREFIXES = ["/admin"];

// Routes only accessible to unauthenticated users
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

function buildCsp(): string {
  const minioEndpoint = process.env.MINIO_ENDPOINT ?? "";
  const minioPort = process.env.MINIO_PORT ?? "9000";
  const minioSsl = process.env.MINIO_USE_SSL === "true";
  const minioOrigin = minioEndpoint
    ? `${minioSsl ? "https" : "http"}://${minioEndpoint}:${minioPort}`
    : "";

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    `connect-src 'self' https://api.stripe.com https://api.brevo.com${minioOrigin ? ` ${minioOrigin}` : ""}`,
    "img-src 'self' data: blob: https: http:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));
  const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  let response: NextResponse;

  if (!isProtected && !isAuthRoute) {
    response = NextResponse.next();
  } else {
    const sessionCookie = getSessionCookie(request);

    if (isProtected && !sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      response = NextResponse.redirect(loginUrl);
    } else if (isAuthRoute && sessionCookie) {
      const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") ?? "/account";
      response = NextResponse.redirect(new URL(callbackUrl, request.url));
    } else if (isAdminRoute && sessionCookie) {
      const cached = await getCookieCache(request);
      if (cached) {
        const role = (cached.user as { role?: string }).role;
        if (role !== "admin") {
          response = NextResponse.redirect(new URL("/", request.url));
        } else {
          response = NextResponse.next();
        }
      } else {
        response = NextResponse.next();
      }
    } else {
      response = NextResponse.next();
    }
  }

  // Security headers on every response
  response.headers.set("Content-Security-Policy", buildCsp());
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (pathname.startsWith("/admin")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)).*)",
  ],
};
