import { notFound } from "next/navigation";
import { db } from "@/db";
import { users, customerProfiles, addresses, orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { CustomerDetailClient } from "@/components/admin/CustomerDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) notFound();

  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, id))
    .limit(1);

  const userAddresses = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, id));

  const userOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, id))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return (
    <CustomerDetailClient
      user={user}
      profile={profile ?? null}
      addresses={userAddresses}
      orders={userOrders}
    />
  );
}
