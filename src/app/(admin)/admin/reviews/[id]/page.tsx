import { getAdminReview } from "@/lib/review-actions";
import { notFound } from "next/navigation";
import ReviewDetailClient from "./review-detail-client";

export const dynamic = "force-dynamic";

export default async function AdminReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const review = await getAdminReview(id);
  if (!review) notFound();
  return <ReviewDetailClient review={review} />;
}
