import { db } from "@/db";
import { shippingBlackoutDates, shippingTimeSlots } from "@/db/schema";
import { ShippingCalendarClient } from "@/components/admin/shipping/ShippingCalendarClient";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ShippingCalendarPage() {
  const [blackouts, slots] = await Promise.all([
    db.select().from(shippingBlackoutDates).orderBy(asc(shippingBlackoutDates.date)),
    db.select().from(shippingTimeSlots).orderBy(asc(shippingTimeSlots.startTime)),
  ]);
  return <ShippingCalendarClient blackouts={blackouts} slots={slots} />;
}
