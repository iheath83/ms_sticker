import { notFound } from "next/navigation";
import { getAdminOrderDetail } from "@/lib/admin-actions";
import { OrderDetailClient } from "@/components/admin/order-detail-client";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getAdminOrderDetail(id);
  if (!detail) notFound();

  // Serialize Dates → ISO strings for the Client Component
  const serialized = {
    order: {
      ...detail.order,
      createdAt: detail.order.createdAt.toISOString(),
      updatedAt: detail.order.updatedAt.toISOString(),
      deletedAt: null,
      customerName: detail.order.customerName,
      customerEmail: detail.order.customerEmail,
      pennylaneInvoiceId: detail.order.pennylaneInvoiceId ?? null,
      pennylaneInvoiceUrl: detail.order.pennylaneInvoiceUrl ?? null,
      sendcloudParcelId: detail.order.sendcloudParcelId ?? null,
      shippingLabelUrl: detail.order.shippingLabelUrl ?? null,
    },
    shippingAddress: detail.shippingAddress,
    billingAddress: detail.billingAddress,
    items: detail.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    events: detail.events.map((ev) => ({
      ...ev,
      createdAt: ev.createdAt.toISOString(),
    })),
    files: detail.files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
    nextStatuses: detail.nextStatuses,
  };

  return <OrderDetailClient detail={serialized} />;
}
