import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory cache to avoid hitting DB on every request
let cache: { data: SiteSettingsPublic; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

interface SiteSettingsPublic {
  maintenanceEnabled: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  maintenanceEmail: string;
  maintenancePhone: string;
}

async function getSettings(): Promise<SiteSettingsPublic> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  let row = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1)
    .then((r) => r[0]);

  if (!row) {
    await db.insert(siteSettings).values({ id: 1 }).onConflictDoNothing();
    row = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1).then((r) => r[0]);
  }

  const data: SiteSettingsPublic = {
    maintenanceEnabled: row?.maintenanceEnabled ?? false,
    maintenanceTitle:   row?.maintenanceTitle   ?? "Bientôt disponible",
    maintenanceMessage: row?.maintenanceMessage ?? "Notre site est en cours de mise à jour.",
    maintenanceEmail:   row?.maintenanceEmail   ?? "",
    maintenancePhone:   row?.maintenancePhone   ?? "",
  };

  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export function invalidateMaintenanceCache() {
  cache = null;
}

export async function GET() {
  try {
    const data = await getSettings();
    return Response.json(data);
  } catch {
    return Response.json({ maintenanceEnabled: false }, { status: 200 });
  }
}
