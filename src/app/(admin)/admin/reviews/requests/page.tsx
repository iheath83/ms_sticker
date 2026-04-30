import { getAdminReviewRequests } from "@/lib/review-actions";
import ReviewRequestsClient from "./review-requests-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demandes d'avis — Admin MS Adhésif" };

export default async function AdminReviewRequestsPage() {
  const initial = await getAdminReviewRequests({ limit: 20 });
  return <ReviewRequestsClient initial={initial} />;
}
