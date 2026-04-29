import { NextResponse, type NextRequest } from "next/server";

const BYPASS_COOKIE = "ms_admin_bypass";

// Paths always allowed regardless of maintenance mode
const ALWAYS_ALLOWED = [
  "/maintenance",
  "/admin",
  "/api/",
  "/_next/",
  "/favicon",
  "/robots",
  "/sitemap",
];

function isAlwaysAllowed(pathname: string): boolean {
  return ALWAYS_ALLOWED.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAlwaysAllowed(pathname)) return NextResponse.next();

  // Admin bypass cookie — set when admin logs in (see admin layout)
  if (request.cookies.get(BYPASS_COOKIE)) return NextResponse.next();

  try {
    const baseUrl = request.nextUrl.origin;
    const res = await fetch(`${baseUrl}/api/maintenance`, {
      headers: { "x-internal": "1" },
    });
    const json = (await res.json()) as { maintenanceEnabled: boolean };

    if (json.maintenanceEnabled) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      return NextResponse.rewrite(url);
    }
  } catch {
    // If we can't reach the API, don't block visitors
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
