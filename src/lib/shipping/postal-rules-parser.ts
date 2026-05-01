import type { PostalCodeRule } from "./types";

/**
 * Parses a multiline postal code rules string into PostalCodeRule[].
 *
 * Supported formats (one rule per line):
 *   75001         → exact
 *   75*           → prefix (everything starting with 75)
 *   75000-75999   → range
 *   !20*          → exclude prefix
 *   !20000-20999  → exclude range
 */
export function parsePostalRulesText(text: string): PostalCodeRule[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const id = String(i);

      if (line.startsWith("!")) {
        const inner = line.slice(1).trim();
        if (inner.includes("-")) {
          const [from = inner, to = inner] = inner.split("-").map((s) => s.trim());
          return { id, type: "exclude" as const, value: from, fromValue: from, toValue: to } satisfies PostalCodeRule;
        }
        if (inner.endsWith("*")) {
          return { id, type: "exclude" as const, value: inner.slice(0, -1) } satisfies PostalCodeRule;
        }
        return { id, type: "exclude" as const, value: inner } satisfies PostalCodeRule;
      }

      if (line.includes("-")) {
        const [from = line, to = line] = line.split("-").map((s) => s.trim());
        return { id, type: "range" as const, value: from, fromValue: from, toValue: to } satisfies PostalCodeRule;
      }

      if (line.endsWith("*")) {
        return { id, type: "prefix" as const, value: line.slice(0, -1) } satisfies PostalCodeRule;
      }

      return { id, type: "exact" as const, value: line } satisfies PostalCodeRule;
    });
}

export function postalRulesToText(rules: Array<{ type: string; value: string; fromValue?: string | null; toValue?: string | null }>): string {
  return rules
    .map((r) => {
      if (r.type === "exclude") {
        if (r.fromValue && r.toValue) return `!${r.fromValue}-${r.toValue}`;
        return `!${r.value}`;
      }
      if (r.type === "prefix") return `${r.value}*`;
      if (r.type === "range") return `${r.fromValue ?? r.value}-${r.toValue ?? r.value}`;
      return r.value;
    })
    .join("\n");
}
