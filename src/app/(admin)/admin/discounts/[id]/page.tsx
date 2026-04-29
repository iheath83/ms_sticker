import { getAdminDiscount } from "@/lib/discount-actions";
import { DiscountFormClient } from "@/components/admin/discounts/discount-form-client";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditDiscountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const discount = await getAdminDiscount(id);
  if (!discount) notFound();
  return <DiscountFormClient existing={discount} />;
}
