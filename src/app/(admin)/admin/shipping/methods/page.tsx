import { db } from "@/db";
import { shippingMethods } from "@/db/schema";
import { asc } from "drizzle-orm";
import { ShippingMethodsClient } from "@/components/admin/shipping/ShippingMethodsClient";

export const dynamic = "force-dynamic";

export default async function ShippingMethodsPage() {
  const methods = await db.select().from(shippingMethods).orderBy(asc(shippingMethods.displayOrder));
  return <ShippingMethodsClient initial={methods} />;
}
