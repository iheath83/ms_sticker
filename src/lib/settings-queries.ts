import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const SETTINGS_DEFAULTS = {
  id: 1,
  logoUrl: null as string | null,
  maintenanceEnabled: false,
  maintenanceTitle: "Bientôt disponible",
  maintenanceMessage: "Notre site est en cours de mise à jour. Revenez très vite !",
  maintenanceEmail: "hello@msadhesif.fr",
  maintenancePhone: "",
  contactEmail: "hello@msadhesif.fr",
  updatedAt: new Date(),
};

export async function getSiteSettingsQuery() {
  try {
    const row = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1)
      .then((r) => r[0]);
    return row ?? SETTINGS_DEFAULTS;
  } catch {
    return SETTINGS_DEFAULTS;
  }
}
