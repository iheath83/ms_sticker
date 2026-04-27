import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse, type NextRequest } from "next/server";

const authHandlers = toNextJsHandler(auth);

export const GET = authHandlers.GET;

// Rate-limited endpoints (attempts / window)
const RATE_LIMITED_PATHS: Record<string, { max: number; windowSecs: number }> = {
  "/sign-in/email": { max: 5, windowSecs: 15 * 60 },
  "/sign-up/email": { max: 5, windowSecs: 60 * 60 },
  "/forget-password": { max: 3, windowSecs: 60 * 60 },
};

export async function POST(request: NextRequest) {
  const pathname = new URL(request.url).pathname;

  for (const [suffix, config] of Object.entries(RATE_LIMITED_PATHS)) {
    if (pathname.endsWith(suffix)) {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        "unknown";

      const result = await checkRateLimit(`auth:${suffix}:${ip}`, config.max, config.windowSecs);

      if (!result.allowed) {
        return NextResponse.json(
          { error: "Trop de tentatives. Veuillez réessayer plus tard." },
          {
            status: 429,
            headers: {
              "Retry-After": String(config.windowSecs),
              ...(result.retryAfter ? { "X-RateLimit-Reset": result.retryAfter } : {}),
            },
          },
        );
      }
      break;
    }
  }

  return authHandlers.POST(request);
}
