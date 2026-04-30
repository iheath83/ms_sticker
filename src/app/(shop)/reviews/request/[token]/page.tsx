import { Suspense } from "react";
import ReviewRequestClient from "./review-request-client";

export default async function ReviewRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Suspense fallback={<div className="text-center py-12">Chargement…</div>}>
        <ReviewRequestClient token={token} />
      </Suspense>
    </div>
  );
}
