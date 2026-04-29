"use server";

import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") throw new Error("Non autorisé");
}

async function ensureSettingsRow() {
  const existing = await db.select({ id: siteSettings.id }).from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  if (existing.length === 0) {
    await db.insert(siteSettings).values({ id: 1 });
  }
}

export async function updateSiteSettings(data: {
  maintenanceEnabled: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  maintenanceEmail: string;
  maintenancePhone: string;
}) {
  await requireAdmin();
  await ensureSettingsRow();

  await db
    .update(siteSettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(siteSettings.id, 1));

  revalidatePath("/admin/settings");
  revalidatePath("/maintenance");

  return { ok: true };
}

export async function getSiteSettings() {
  await ensureSettingsRow();
  const row = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1).then((r) => r[0]);
  return row ?? {
    id: 1,
    maintenanceEnabled: false,
    maintenanceTitle: "Bientôt disponible",
    maintenanceMessage: "Notre site est en cours de mise à jour. Revenez très vite !",
    maintenanceEmail: "hello@msadhesif.fr",
    maintenancePhone: "",
    updatedAt: new Date(),
  };
}
