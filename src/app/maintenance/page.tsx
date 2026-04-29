import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MaintenanceClient } from "./maintenance-client";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  let settings = {
    maintenanceTitle:   "Bientôt disponible",
    maintenanceMessage: "Notre site est en cours de mise à jour. Revenez très vite !",
    maintenanceEmail:   "hello@msadhesif.fr",
    maintenancePhone:   "",
  };

  try {
    const row = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1)
      .then((r) => r[0]);
    if (row) {
      settings = {
        maintenanceTitle:   row.maintenanceTitle,
        maintenanceMessage: row.maintenanceMessage,
        maintenanceEmail:   row.maintenanceEmail,
        maintenancePhone:   row.maintenancePhone,
      };
    }
  } catch {}

  return <MaintenanceClient {...settings} />;
}
