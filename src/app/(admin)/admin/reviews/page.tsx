import { getAdminReviews } from "@/lib/review-actions";
import AdminReviewsClient from "./admin-reviews-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avis clients — Admin MS Adhésif" };

export default async function AdminReviewsPage() {
  const initial = await getAdminReviews({ limit: 20 });
  return <AdminReviewsClient initial={initial} />;
}
