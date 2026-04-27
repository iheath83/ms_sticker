import { Suspense } from "react";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ConfirmationClient } from "@/components/shop/checkout/confirmation-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commande confirmée — MS Adhésif",
};

interface Props {
  searchParams: Promise<{ order_id?: string; order?: string; total?: string }>;
}

async function fetchOrderData(orderId: string) {
  try {
    const [order] = await db
      .select({
        id: orders.id,
        totalCents: orders.totalCents,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    return order ?? null;
  } catch {
    return null;
  }
}

function formatOrderNumber(orderId: string) {
  return "MS-" + orderId.replace(/-/g, "").substring(0, 8).toUpperCase();
}

export default async function ConfirmationPage({ searchParams }: Props) {
  const params = await searchParams;

  // Try to get order data from DB (new flow: order_id from Stripe redirect)
  const orderId = params.order_id;
  let orderNum: string | null = null;
  let totalCents: number | null = null;

  if (orderId) {
    const order = await fetchOrderData(orderId);
    if (order) {
      orderNum = formatOrderNumber(order.id);
      totalCents = order.totalCents;
    }
  }

  // Fallback: old flow via ?order= and ?total= params
  if (!orderNum && params.order) {
    orderNum = params.order;
  }
  if (totalCents === null && params.total) {
    totalCents = parseInt(params.total, 10);
  }

  return (
    <Suspense>
      <ConfirmationClient
        orderNum={orderNum ?? ""}
        totalCents={totalCents ?? 0}
      />
    </Suspense>
  );
}
