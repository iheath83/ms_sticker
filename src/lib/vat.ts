// No "use server" directive — this module exports both async and sync helpers.
// Async functions are called from server actions (order-actions.ts).

import { db } from "@/db";
import { viesCache } from "@/db/schema";
import { eq, gt } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VatValidationResult {
  valid: boolean;
  vatNumber: string;
  countryCode: string;
  companyName?: string | undefined;
  companyAddress?: string | undefined;
  fromCache: boolean;
}

export interface VatRateResult {
  rate: number;
  reverseCharge: boolean;
  label: string; // mention légale
}

// ─── EU member state country codes ────────────────────────────────────────────

const EU_COUNTRY_CODES = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU",
  "IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK",
]);

// ─── Normalise VAT number ──────────────────────────────────────────────────────

function normalise(raw: string): { countryCode: string; number: string } | null {
  const clean = raw.replace(/\s/g, "").toUpperCase();
  if (clean.length < 4) return null;
  const countryCode = clean.slice(0, 2);
  if (!EU_COUNTRY_CODES.has(countryCode)) return null;
  return { countryCode, number: clean.slice(2) };
}

// ─── VIES SOAP call ───────────────────────────────────────────────────────────

async function callVies(countryCode: string, vatNumber: string): Promise<{
  valid: boolean;
  name?: string | undefined;
  address?: string | undefined;
}> {
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Body>
    <urn:checkVat>
      <urn:countryCode>${countryCode}</urn:countryCode>
      <urn:vatNumber>${vatNumber}</urn:vatNumber>
    </urn:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const res = await fetch(
      "https://ec.europa.eu/taxation_customs/vies/services/checkVatService",
      {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
        body: soapBody,
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) return { valid: false };

    const xml = await res.text();
    const valid = /<valid>true<\/valid>/.test(xml);
    const name = xml.match(/<name>(.*?)<\/name>/)?.[1]?.trim();
    const address = xml.match(/<address>([\s\S]*?)<\/address>/)?.[1]
      ?.trim()
      .replace(/\n/g, ", ");

    const result: { valid: boolean; name?: string | undefined; address?: string | undefined } = { valid };
    if (name && name !== "---") result.name = name;
    if (address && address !== "---") result.address = address;
    return result;
  } catch {
    // VIES is often unavailable — treat as unknown (not invalid)
    return { valid: false };
  }
}

// ─── Validate VAT number (with 24h DB cache) ─────────────────────────────────

export async function validateVatNumber(
  rawVatNumber: string,
): Promise<VatValidationResult> {
  const parsed = normalise(rawVatNumber);
  if (!parsed) {
    return { valid: false, vatNumber: rawVatNumber, countryCode: "", fromCache: false };
  }

  const { countryCode, number } = parsed;
  const fullVat = countryCode + number;
  const now = new Date();

  // Check cache
  const [cached] = await db
    .select()
    .from(viesCache)
    .where(eq(viesCache.vatNumber, fullVat))
    .limit(1);

  if (cached && cached.expiresAt > now) {
    return {
      valid: cached.valid,
      vatNumber: fullVat,
      countryCode,
      companyName: cached.companyName ?? undefined,
      companyAddress: cached.companyAddress ?? undefined,
      fromCache: true,
    };
  }

  // Call VIES
  const ttlHours = Number(process.env.VIES_CACHE_TTL_HOURS ?? "24");
  const viesResult = await callVies(countryCode, number);
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

  // Upsert cache
  try {
    if (cached) {
      await db
        .update(viesCache)
        .set({
          valid: viesResult.valid,
          companyName: viesResult.name ?? null,
          companyAddress: viesResult.address ?? null,
          checkedAt: now,
          expiresAt,
        })
        .where(eq(viesCache.vatNumber, fullVat));
    } else {
      await db.insert(viesCache).values({
        vatNumber: fullVat,
        countryCode,
        valid: viesResult.valid,
        companyName: viesResult.name ?? null,
        companyAddress: viesResult.address ?? null,
        checkedAt: now,
        expiresAt,
      });
    }
  } catch {
    // Non-blocking cache write failure
  }

  return {
    valid: viesResult.valid,
    vatNumber: fullVat,
    countryCode,
    companyName: viesResult.name,
    companyAddress: viesResult.address,
    fromCache: false,
  };
}

// ─── Compute VAT rate for a given customer context ────────────────────────────

export async function computeVatRate(input: {
  customerCountryCode: string;
  vatNumber?: string;
  isProfessional?: boolean;
}): Promise<VatRateResult> {
  const { customerCountryCode, vatNumber, isProfessional } = input;

  // French customers: always 20%
  if (customerCountryCode === "FR" || !customerCountryCode) {
    return { rate: 0.20, reverseCharge: false, label: "TVA 20%" };
  }

  // Outside EU: 0%, no VAT
  if (!EU_COUNTRY_CODES.has(customerCountryCode)) {
    return { rate: 0, reverseCharge: false, label: "Exportation — TVA non applicable" };
  }

  // EU (non-FR): check for valid B2B VAT number → reverse charge
  if (isProfessional && vatNumber) {
    const result = await validateVatNumber(vatNumber);
    if (result.valid && result.countryCode !== "FR") {
      return {
        rate: 0,
        reverseCharge: true,
        label: "Autoliquidation — Art. 283-2 du CGI",
      };
    }
  }

  // EU consumer (B2C): 20%
  return { rate: 0.20, reverseCharge: false, label: "TVA 20%" };
}

// ─── Pure helpers (no async) ──────────────────────────────────────────────────

export function isEuCountry(countryCode: string): boolean {
  return EU_COUNTRY_CODES.has(countryCode.toUpperCase());
}

export function formatVatMention(reverseCharge: boolean): string {
  return reverseCharge
    ? "Autoliquidation de TVA — Art. 283-2 du CGI. TVA due par le preneur assujetti."
    : "";
}
