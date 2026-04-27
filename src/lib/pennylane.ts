/**
 * Pennylane API v2 client — typed, no SDK.
 * Source of truth for invoice creation (legal requirement FR).
 *
 * API docs: https://pennylane.readme.io/reference
 * 2026 changes: X-Use-2026-API-Changes header required.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PennylaneCustomer {
  id: number;
  name: string;
  emails: string[];
}

export interface PennylaneInvoiceLine {
  label: string;
  quantity: number;
  /** Unit price excluding taxes, as string, up to 6 decimals */
  raw_currency_unit_price: string;
  /** Pennylane VAT rate code — FR 20% = "FR_200" */
  vat_rate: string;
  unit?: string;
}

export interface PennylaneInvoice {
  id: number;
  invoice_number: string;
  status: string;
  file_url?: string | null;
  pdf_invoice_url?: string | null;
  amount?: string;
}

type PennylaneResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getConfig() {
  const apiKey = process.env["PENNYLANE_API_KEY"];
  const apiBase = process.env["PENNYLANE_API_BASE"] ?? "https://app.pennylane.com/api/external/v2";
  if (!apiKey) throw new Error("PENNYLANE_API_KEY is not set");
  return { apiKey, apiBase };
}

async function plFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<PennylaneResult<T>> {
  const { apiKey, apiBase } = getConfig();

  const url = `${apiBase}${path}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Use-2026-API-Changes": "true",
    ...(options.headers as Record<string, string> ?? {}),
  };

  console.log(`[Pennylane] ${options.method ?? "GET"} ${url}`);
  if (options.body) {
    try { console.log("[Pennylane] body:", JSON.stringify(JSON.parse(options.body as string), null, 2)); } catch { /* noop */ }
  }

  try {
    const res = await fetch(url, { ...options, headers });
    let json: Record<string, unknown> = {};
    const rawText = await res.text();

    try { json = JSON.parse(rawText) as Record<string, unknown>; } catch {
      console.error("[Pennylane] Non-JSON response:", rawText.slice(0, 500));
      return { ok: false, error: `[Pennylane] Non-JSON response: ${rawText.slice(0, 200)}` };
    }

    if (!res.ok) {
      const message =
        typeof json["error"] === "string"
          ? json["error"]
          : typeof json["message"] === "string"
            ? json["message"]
            : typeof json["errors"] !== "undefined"
              ? JSON.stringify(json["errors"])
              : `HTTP ${res.status}`;
      console.error(`[Pennylane] Error ${res.status} on ${options.method ?? "GET"} ${url}:`, JSON.stringify(json, null, 2));
      return { ok: false, error: `[Pennylane] ${res.status} — ${message}` };
    }

    console.log(`[Pennylane] OK ${res.status} — response keys:`, Object.keys(json));
    return { ok: true, data: json as T };
  } catch (err) {
    console.error("[Pennylane] Network error:", err);
    return { ok: false, error: `[Pennylane] Network error: ${String(err)}` };
  }
}

// ─── Customer: search by email ────────────────────────────────────────────────

interface CustomersListResponse {
  items?: Array<{ id: number; name: string; emails: string[] }>;
  // v1 fallback
  customers?: Array<{ id: number; name: string; emails: string[] }>;
}

export async function findCustomerByEmail(
  email: string,
): Promise<PennylaneResult<PennylaneCustomer | null>> {
  const filter = encodeURIComponent(JSON.stringify([{ field: "emails", operator: "in", value: [email] }]));
  const res = await plFetch<CustomersListResponse>(
    `/customers?filter=${filter}&limit=1`,
  );

  if (!res.ok) return res;

  const customers = res.data.items ?? res.data.customers ?? [];
  return { ok: true, data: customers[0] ?? null };
}

// ─── Customer: create company customer ───────────────────────────────────────

interface CreateCustomerPayload {
  name: string;
  emails: string[];
  billing_address: {
    address: string;
    postal_code: string;
    city: string;
    country_alpha2: string;
  };
  vat_number?: string;
}

export async function createCompanyCustomer(
  payload: CreateCustomerPayload,
): Promise<PennylaneResult<PennylaneCustomer>> {
  // v2 returns the object directly (no {customer: ...} wrapper)
  const res = await plFetch<PennylaneCustomer>("/company_customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) return res;
  if (!res.data?.id) return { ok: false, error: "[Pennylane] No customer in response" };

  return { ok: true, data: res.data };
}

// ─── Create individual customer (fallback for B2C) ────────────────────────────

interface CreateIndividualCustomerPayload {
  first_name: string;
  last_name: string;
  emails: string[];
  billing_address: {
    address: string;
    postal_code: string;
    city: string;
    country_alpha2: string;
  };
}

export async function createIndividualCustomer(
  payload: CreateIndividualCustomerPayload,
): Promise<PennylaneResult<PennylaneCustomer>> {
  // v2 returns the object directly (no {customer: ...} wrapper)
  const res = await plFetch<PennylaneCustomer>("/individual_customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) return res;
  if (!res.data?.id) return { ok: false, error: "[Pennylane] No customer in response" };

  return { ok: true, data: res.data };
}

// ─── Get or create customer ───────────────────────────────────────────────────

export interface CustomerInfo {
  email: string;
  name?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
}

export async function getOrCreateCustomer(
  info: CustomerInfo,
): Promise<PennylaneResult<PennylaneCustomer>> {
  // 1. Search existing
  const existing = await findCustomerByEmail(info.email);
  if (!existing.ok) return existing;
  if (existing.data) return { ok: true, data: existing.data };

  // 2. Create new
  const billingAddress = {
    address: "—",
    postal_code: "00000",
    city: "—",
    country_alpha2: "FR",
  };

  if (info.companyName) {
    return createCompanyCustomer({
      name: info.companyName,
      emails: [info.email],
      billing_address: billingAddress,
      ...(info.vatNumber ? { vat_number: info.vatNumber } : {}),
    });
  }

  // B2C individual
  const parts = (info.name ?? info.email).split(" ");
  const first = parts[0] ?? info.email;
  const last = parts.slice(1).join(" ") || "—";

  return createIndividualCustomer({
    first_name: first,
    last_name: last,
    emails: [info.email],
    billing_address: billingAddress,
  });
}

// ─── Create and finalize invoice ──────────────────────────────────────────────

interface CreateInvoicePayload {
  customerId: number;
  date: string; // ISO date YYYY-MM-DD
  deadline: string; // ISO date YYYY-MM-DD
  lines: PennylaneInvoiceLine[];
  externalReference?: string;
  subject?: string;
  description?: string;
  vatRate?: string;
}

interface CreateInvoiceResponse {
  id?: number;
  invoice_number?: string;
  status?: string;
  file_url?: string | null;
  pdf_invoice_url?: string | null;
  // v1 legacy wrapper fallback
  invoice?: {
    id: number;
    invoice_number: string;
    status: string;
    file_url?: string | null;
    pdf_invoice_url?: string | null;
  };
}

export async function createAndFinalizeInvoice(
  payload: CreateInvoicePayload,
): Promise<PennylaneResult<PennylaneInvoice>> {
  const today = payload.date;
  const deadline = payload.deadline;

  const body = {
    date: today,
    deadline,
    customer_id: payload.customerId,
    draft: false, // finalized immediately
    external_reference: payload.externalReference,
    pdf_invoice_subject: payload.subject ?? "Facture MS Adhésif",
    pdf_description: payload.description,
    currency: "EUR",
    language: "fr_FR",
    invoice_lines: payload.lines.map((line) => ({
      label: line.label,
      quantity: line.quantity,
      raw_currency_unit_price: line.raw_currency_unit_price,
      vat_rate: line.vat_rate,
      unit: line.unit ?? "unité",
    })),
  };

  const res = await plFetch<CreateInvoiceResponse>("/customer_invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) return res;

  // v2 returns object directly; v1 wrapped in {invoice: ...}
  const raw = res.data.invoice ?? res.data;
  const invoice = raw as { id: number; invoice_number: string; status: string; file_url?: string | null; pdf_invoice_url?: string | null };
  if (!invoice?.id) return { ok: false, error: "[Pennylane] No invoice in response" };

  // PDF might not be ready yet — try a second GET to get the URL
  let pdfUrl: string | null = (invoice as { public_file_url?: string | null }).public_file_url
    ?? invoice.pdf_invoice_url
    ?? invoice.file_url
    ?? null;

  if (!pdfUrl) {
    const fetchRes = await plFetch<{ public_file_url?: string | null; file_url?: string | null; pdf_invoice_url?: string | null; invoice?: { public_file_url?: string | null; file_url?: string | null; pdf_invoice_url?: string | null } }>(
      `/customer_invoices/${invoice.id}`,
    );
    if (fetchRes.ok) {
      const fetched = fetchRes.data.invoice ?? fetchRes.data;
      pdfUrl = (fetched as { public_file_url?: string | null }).public_file_url
        ?? (fetched as { pdf_invoice_url?: string | null }).pdf_invoice_url
        ?? (fetched as { file_url?: string | null }).file_url
        ?? null;
    }
  }

  return {
    ok: true,
    data: {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      file_url: pdfUrl,
      pdf_invoice_url: pdfUrl,
    },
  };
}

// ─── Get invoice by ID ────────────────────────────────────────────────────────

export async function getInvoicePdfUrl(
  invoiceId: string | number,
): Promise<PennylaneResult<{ invoiceUrl: string | null }>> {
  type InvoiceResp = { id: number; public_file_url?: string | null; file_url?: string | null; pdf_invoice_url?: string | null; invoice?: { id: number; public_file_url?: string | null; file_url?: string | null; pdf_invoice_url?: string | null } };
  const res = await plFetch<InvoiceResp>(`/customer_invoices/${invoiceId}`);
  if (!res.ok) return res;
  const raw = (res.data.invoice ?? res.data) as { public_file_url?: string | null; file_url?: string | null; pdf_invoice_url?: string | null };
  const invoiceUrl = raw.public_file_url ?? raw.pdf_invoice_url ?? raw.file_url ?? null;
  return { ok: true, data: { invoiceUrl } };
}

// ─── Create credit note (avoir) ───────────────────────────────────────────────

export interface CreditNoteResult {
  id: number;
  invoice_number: string;
  public_file_url: string | null;
}

export async function createCreditNote(params: {
  customerId: number;
  creditedInvoiceId: number | string;
  amountCentsTTC: number;
  vatRate: number; // e.g. 0.2
  date: string; // YYYY-MM-DD
  description?: string;
}): Promise<PennylaneResult<CreditNoteResult>> {
  const { customerId, creditedInvoiceId, amountCentsTTC, vatRate, date, description } = params;

  // Compute excl-tax amount from TTC
  const amountExclTax = amountCentsTTC / (1 + vatRate);
  const amountExclTaxStr = (-(amountExclTax / 100)).toFixed(4); // negative, in euros

  const vatCode = vatRateToCode(vatRate);

  const body = {
    date,
    deadline: date,
    customer_id: customerId,
    draft: false,
    credited_invoice_id: Number(creditedInvoiceId),
    pdf_invoice_subject: "Avoir MS Adhésif",
    pdf_description: description ?? "Remboursement partiel ou total",
    currency: "EUR",
    language: "fr_FR",
    invoice_lines: [
      {
        label: "Remboursement",
        quantity: 1,
        raw_currency_unit_price: amountExclTaxStr,
        vat_rate: vatCode,
        unit: "forfait",
      },
    ],
  };

  type CreditNoteResp = { id: number; invoice_number: string; public_file_url?: string | null };
  const res = await plFetch<CreditNoteResp>("/customer_invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) return res;
  const raw = (res.data as { invoice?: CreditNoteResp } & CreditNoteResp).invoice ?? res.data;
  if (!raw?.id) return { ok: false, error: "[Pennylane] No credit note in response" };

  return {
    ok: true,
    data: {
      id: raw.id,
      invoice_number: raw.invoice_number,
      public_file_url: raw.public_file_url ?? null,
    },
  };
}

// ─── Build invoice from order data ───────────────────────────────────────────

export interface OrderItemForInvoice {
  label: string;
  quantity: number;
  unitPriceCentsExclTax: number;
  vatRate: number; // e.g. 0.2 for 20%
}

/**
 * Converts a VAT rate decimal (e.g. 0.2) to Pennylane's VAT rate code.
 * Only French rates are supported for now.
 */
export function vatRateToCode(rate: number): string {
  const pct = Math.round(rate * 1000); // 0.2 → 200, 0.055 → 55
  return `FR_${pct}`;
}

/**
 * Converts cents to a euro string for Pennylane (excl. tax, 2 decimals).
 */
export function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}
