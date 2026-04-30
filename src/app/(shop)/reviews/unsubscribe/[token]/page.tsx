import UnsubscribeClient from "./unsubscribe-client";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <UnsubscribeClient token={token} />
    </div>
  );
}
