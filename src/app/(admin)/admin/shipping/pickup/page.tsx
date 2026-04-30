import { db } from "@/db";
import { shippingPickupLocations } from "@/db/schema";
import { ShippingPickupClient } from "@/components/admin/shipping/ShippingPickupClient";

export const dynamic = "force-dynamic";

export default async function ShippingPickupPage() {
  const locations = await db.select().from(shippingPickupLocations);
  return <ShippingPickupClient initial={locations} />;
}
