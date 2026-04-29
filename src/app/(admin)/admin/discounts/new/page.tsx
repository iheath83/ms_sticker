import { DiscountFormClient } from "@/components/admin/discounts/discount-form-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouvelle réduction — Admin MS Adhésif" };

export default function NewDiscountPage() {
  return <DiscountFormClient />;
}
