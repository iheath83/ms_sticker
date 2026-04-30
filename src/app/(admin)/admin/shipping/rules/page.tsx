import { db } from "@/db";
import { shippingRules } from "@/db/schema";
import { asc } from "drizzle-orm";
import { ShippingRulesClient } from "@/components/admin/shipping/ShippingRulesClient";
import type { ShippingRuleDB } from "@/lib/shipping/types";

export const dynamic = "force-dynamic";

export default async function ShippingRulesPage() {
  const rows = await db.select().from(shippingRules).orderBy(asc(shippingRules.priority));
  const rules: ShippingRuleDB[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isActive: r.isActive,
    priority: r.priority,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    conditionRoot: r.conditionRoot as ShippingRuleDB["conditionRoot"],
    actions: (r.actions as ShippingRuleDB["actions"]) ?? [],
    stopProcessingAfterMatch: r.stopProcessingAfterMatch,
    combinableWithOtherRules: r.combinableWithOtherRules,
  }));

  return <ShippingRulesClient initial={rules} />;
}
