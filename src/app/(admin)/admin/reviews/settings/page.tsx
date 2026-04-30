import { getReviewSettings } from "@/lib/review-actions";
import ReviewSettingsClient from "./review-settings-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paramètres avis — Admin MS Adhésif" };

export default async function AdminReviewSettingsPage() {
  const settings = await getReviewSettings();
  return <ReviewSettingsClient initial={settings} />;
}
