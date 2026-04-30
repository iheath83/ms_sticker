import type { ShippingDebugLog, ConditionDebug } from "./types";

export function formatDebugLog(log: ShippingDebugLog): string {
  const status = log.matched ? "✓ MATCH" : "✗ NO MATCH";
  const conditions = log.conditions
    .map((c) => `  ${c.matched ? "✓" : "✗"} ${c.field} ${c.operator} ${JSON.stringify(c.expected)} (actual: ${JSON.stringify(c.actual)})`)
    .join("\n");
  const actions = log.actionsApplied.length > 0 ? `  Actions: ${log.actionsApplied.join(", ")}` : "";
  return `[Rule: ${log.ruleName}] ${status}\n${conditions}${actions}`;
}

export function createDebugLog(
  ruleId: string,
  ruleName: string,
  matched: boolean,
  conditions: ConditionDebug[],
  actionsApplied: string[],
): ShippingDebugLog {
  return { ruleId, ruleName, matched, conditions, actionsApplied };
}
