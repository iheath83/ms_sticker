import { db } from "@/db";
import { shippingZones, shippingZonePostalRules } from "@/db/schema";
import { asc } from "drizzle-orm";
import { ShippingZonesClient } from "@/components/admin/shipping/ShippingZonesClient";

export const dynamic = "force-dynamic";

export default async function ShippingZonesPage() {
  const zones = await db.select().from(shippingZones).orderBy(asc(shippingZones.name));
  const postalRules = await db.select().from(shippingZonePostalRules);

  const zonesWithRules = zones.map((z) => ({
    id: z.id,
    name: z.name,
    description: z.description,
    countries: (z.countries as string[]) ?? [],
    regions: (z.regions as string[]) ?? [],
    cities: (z.cities as string[]) ?? [],
    isActive: z.isActive,
    postalRules: postalRules
      .filter((r) => r.zoneId === z.id)
      .map((r) => ({
        id: r.id,
        type: r.type,
        value: r.value,
        fromValue: r.fromValue,
        toValue: r.toValue,
      })),
  }));

  return <ShippingZonesClient initial={zonesWithRules} />;
}
