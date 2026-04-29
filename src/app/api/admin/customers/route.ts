import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ilike, or, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Lookup by exact IDs (used when loading an existing discount)
  const idsParam = request.nextUrl.searchParams.get("ids")?.trim();
  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, ids));
    return NextResponse.json(rows);
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      q.length >= 2
        ? or(
            ilike(users.email, `%${q}%`),
            ilike(users.name, `%${q}%`),
          )
        : eq(users.role, "customer"),
    )
    .limit(20);

  return NextResponse.json(rows);
}
