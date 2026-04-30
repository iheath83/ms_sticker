import type { PostalCodeRule } from "./types";

function normalize(code: string): string {
  return code.trim().toUpperCase();
}

function matchesRule(postalCode: string, rule: PostalCodeRule): boolean {
  const pc = normalize(postalCode);
  const val = normalize(rule.value);

  switch (rule.type) {
    case "exact":
      return pc === val;
    case "prefix":
      return pc.startsWith(val);
    case "range": {
      const from = normalize(rule.fromValue ?? rule.value);
      const to = normalize(rule.toValue ?? rule.value);
      return pc >= from && pc <= to;
    }
    case "regex": {
      try {
        // Sanitize: only allow safe regex characters
        const safe = rule.value.replace(/[^a-zA-Z0-9\\^$.*+?()[\]{}|]/g, "");
        return new RegExp(`^${safe}$`).test(pc);
      } catch {
        return false;
      }
    }
    case "exclude":
      return false;
  }
}

/**
 * Returns true if an exclude rule matches the given postal code.
 * Supports: exact, prefix (value without trailing *), and range (fromValue/toValue).
 */
function excludeMatches(pc: string, rule: PostalCodeRule): boolean {
  const val = normalize(rule.value);
  // Range exclude: fromValue and toValue are set
  if (rule.fromValue && rule.toValue) {
    const from = normalize(rule.fromValue);
    const to = normalize(rule.toValue);
    return pc >= from && pc <= to;
  }
  // Prefix exclude (value is a prefix without *)
  if (pc.startsWith(val)) return true;
  return false;
}

/**
 * Returns true if the postal code is covered by the set of rules.
 * Exclude rules override include rules (they act as blockers).
 */
export function postalCodeMatchesRules(postalCode: string, rules: PostalCodeRule[]): boolean {
  if (!postalCode || rules.length === 0) return false;

  const pc = normalize(postalCode);
  const includeRules = rules.filter((r) => r.type !== "exclude");
  const excludeRules = rules.filter((r) => r.type === "exclude");

  // Check exclusions first — a matching exclusion blocks the code
  for (const rule of excludeRules) {
    if (excludeMatches(pc, rule)) return false;
  }

  // At least one include rule must match
  return includeRules.some((rule) => matchesRule(postalCode, rule));
}

/**
 * Returns true if the postal code belongs to an exclusion rule only
 * (useful for zone membership check when there are no include rules).
 */
export function postalCodeIsExcluded(postalCode: string, rules: PostalCodeRule[]): boolean {
  const pc = normalize(postalCode);
  return rules
    .filter((r) => r.type === "exclude")
    .some((r) => excludeMatches(pc, r));
}
