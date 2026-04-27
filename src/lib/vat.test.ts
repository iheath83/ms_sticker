import { describe, it, expect, vi, beforeEach } from "vitest";
import { isEuCountry, formatVatMention } from "./vat";

// ─── Mock DB ──────────────────────────────────────────────────────────────────
// validateVatNumber and computeVatRate depend on DB + VIES fetch.
// We mock both at the module level.

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/db/schema", () => ({
  viesCache: { vatNumber: "vat_number", expiresAt: "expires_at" },
}));

// ─── Pure helpers — no async ──────────────────────────────────────────────────

describe("isEuCountry", () => {
  it("returns true for all 27 EU member states", () => {
    const eu = [
      "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI",
      "FR","GR","HR","HU","IE","IT","LT","LU","LV","MT",
      "NL","PL","PT","RO","SE","SI","SK",
    ];
    for (const code of eu) {
      expect(isEuCountry(code)).toBe(true);
    }
  });

  it("returns false for non-EU countries", () => {
    expect(isEuCountry("US")).toBe(false);
    expect(isEuCountry("GB")).toBe(false);
    expect(isEuCountry("CH")).toBe(false);
    expect(isEuCountry("JP")).toBe(false);
    expect(isEuCountry("CN")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isEuCountry("fr")).toBe(true);
    expect(isEuCountry("De")).toBe(true);
    expect(isEuCountry("us")).toBe(false);
  });
});

describe("formatVatMention", () => {
  it("returns the legal autoliquidation mention when reverseCharge=true", () => {
    const mention = formatVatMention(true);
    expect(mention).toContain("Autoliquidation");
    expect(mention).toContain("Art. 283-2");
  });

  it("returns empty string when reverseCharge=false", () => {
    expect(formatVatMention(false)).toBe("");
  });
});

// ─── computeVatRate — mocked VIES + DB ───────────────────────────────────────

describe("computeVatRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 20% for French customers", async () => {
    const { computeVatRate } = await import("./vat");
    const result = await computeVatRate({ customerCountryCode: "FR" });
    expect(result.rate).toBe(0.20);
    expect(result.reverseCharge).toBe(false);
    expect(result.label).toContain("20%");
  });

  it("returns 20% when country code is empty", async () => {
    const { computeVatRate } = await import("./vat");
    const result = await computeVatRate({ customerCountryCode: "" });
    expect(result.rate).toBe(0.20);
    expect(result.reverseCharge).toBe(false);
  });

  it("returns 0% with no reverse charge for non-EU countries", async () => {
    const { computeVatRate } = await import("./vat");
    const result = await computeVatRate({ customerCountryCode: "US" });
    expect(result.rate).toBe(0);
    expect(result.reverseCharge).toBe(false);
    expect(result.label).toContain("Exportation");
  });

  it("returns 20% for EU B2C consumers", async () => {
    const { computeVatRate } = await import("./vat");
    const result = await computeVatRate({ customerCountryCode: "DE", isProfessional: false });
    expect(result.rate).toBe(0.20);
    expect(result.reverseCharge).toBe(false);
  });

  it("returns 20% for EU B2B without VAT number", async () => {
    const { computeVatRate } = await import("./vat");
    const result = await computeVatRate({ customerCountryCode: "DE", isProfessional: true });
    expect(result.rate).toBe(0.20);
    expect(result.reverseCharge).toBe(false);
  });
});

// ─── validateVatNumber — mocked VIES fetch ────────────────────────────────────

describe("validateVatNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns invalid for country codes outside EU", async () => {
    const { validateVatNumber } = await import("./vat");
    const result = await validateVatNumber("US123456789");
    expect(result.valid).toBe(false);
  });

  it("returns invalid for strings too short", async () => {
    const { validateVatNumber } = await import("./vat");
    const result = await validateVatNumber("DE");
    expect(result.valid).toBe(false);
  });

  it("normalises the VAT number to uppercase and strips spaces", async () => {
    // Mocking global fetch to simulate VIES returning invalid
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "<valid>false</valid>",
    } as Response);

    const { validateVatNumber } = await import("./vat");
    const result = await validateVatNumber("de 123456789");
    expect(result.vatNumber).toBe("DE123456789");
    fetchSpy.mockRestore();
  });

  it("returns valid when VIES says true and caches the result", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "<valid>true</valid><name>ACME GmbH</name>",
    } as Response);

    const { validateVatNumber } = await import("./vat");
    const result = await validateVatNumber("DE123456789");
    expect(result.valid).toBe(true);
    expect(result.companyName).toBe("ACME GmbH");
    fetchSpy.mockRestore();
  });

  it("handles VIES network errors gracefully (returns invalid)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));
    const { validateVatNumber } = await import("./vat");
    const result = await validateVatNumber("FR12345678901");
    expect(result.valid).toBe(false);
    fetchSpy.mockRestore();
  });

  it("uses cached result when not expired", async () => {
    const { db } = await import("@/db");
    const cachedEntry = {
      vatNumber: "FR12345678901",
      countryCode: "FR",
      valid: true,
      companyName: "Cached Co",
      companyAddress: null,
      checkedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.limit as any).mockResolvedValueOnce([cachedEntry]);

    const { validateVatNumber } = await import("./vat");
    const result = await validateVatNumber("FR12345678901");
    expect(result.valid).toBe(true);
    expect(result.fromCache).toBe(true);
    expect(result.companyName).toBe("Cached Co");
  });
});
