import { getAdminDiscounts } from "@/lib/discount-actions";
import { DiscountListClient } from "@/components/admin/discounts/discount-list-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Réductions — Admin MS Adhésif" };

export default async function AdminDiscountsPage() {
  const discounts = await getAdminDiscounts();
  return <DiscountListClient initialDiscounts={discounts} />;
}
