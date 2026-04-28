import { CheckoutClient } from "@/components/shop/checkout/checkout-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Finaliser ma commande — MS Adhésif",
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
