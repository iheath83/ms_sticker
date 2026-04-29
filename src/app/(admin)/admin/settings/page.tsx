import { getSiteSettings } from "@/lib/settings-actions";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Paramètres — Admin MS Adhésif" };

export default async function SettingsPage() {
  const settings = await getSiteSettings();
  return <SettingsClient settings={settings} />;
}
