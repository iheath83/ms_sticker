import { getMyOrderDetail } from "@/lib/customer-actions";
import { notFound } from "next/navigation";
import OrderDetailClient from "@/components/account/order-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MyOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await getMyOrderDetail(id);
  if (!detail) notFound();

  const serialized = {
    order: {
      ...detail.order,
      createdAt: detail.order.createdAt.toISOString(),
      updatedAt: detail.order.updatedAt.toISOString(),
      stripePaymentIntentId: detail.order.stripePaymentIntentId ?? null,
      pennylaneInvoiceUrl: detail.order.pennylaneInvoiceUrl ?? null,
      pennylaneInvoiceId: detail.order.pennylaneInvoiceId ?? null,
      deliveryMethod: detail.order.deliveryMethod ?? null,
      cardLast4: detail.order.cardLast4 ?? null,
      totalRefundedCents: detail.order.totalRefundedCents,
      shippingAddress: detail.order.shippingAddress ?? null,
      billingAddress: detail.order.billingAddress ?? null,
    },
    items: detail.items.map((item) => ({
      ...item,
      customerFile: item.customerFile ?? null,
    })),
    events: detail.events.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    proofs: detail.proofs.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    })),
    canApprove: detail.canApprove,
    canRequestRevision: detail.canRequestRevision,
  };

  return <OrderDetailClient detail={serialized} />;
}
