import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  vatRateToCode,
  centsToEuroString,
  findCustomerByEmail,
  createCompanyCustomer,
  createIndividualCustomer,
  getOrCreateCustomer,
  createAndFinalizeInvoice,
  getInvoicePdfUrl,
  createCreditNote,
} from "./pennylane";

// ─── Environment setup ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubEnv("PENNYLANE_API_KEY", "test-api-key");
  vi.stubEnv("PENNYLANE_API_BASE", "https://api.pennylane.test/v2");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe("vatRateToCode", () => {
  it("converts 0.2 to FR_200", () => {
    expect(vatRateToCode(0.2)).toBe("FR_200");
  });

  it("converts 0.055 to FR_55", () => {
    expect(vatRateToCode(0.055)).toBe("FR_55");
  });

  it("converts 0.1 to FR_100", () => {
    expect(vatRateToCode(0.1)).toBe("FR_100");
  });

  it("converts 0 to FR_0", () => {
    expect(vatRateToCode(0)).toBe("FR_0");
  });
});

describe("centsToEuroString", () => {
  it("converts 1000 cents to '10.00'", () => {
    expect(centsToEuroString(1000)).toBe("10.00");
  });

  it("converts 0 to '0.00'", () => {
    expect(centsToEuroString(0)).toBe("0.00");
  });

  it("converts 1 cent to '0.01'", () => {
    expect(centsToEuroString(1)).toBe("0.01");
  });

  it("converts 99999 cents to '999.99'", () => {
    expect(centsToEuroString(99999)).toBe("999.99");
  });

  it("handles large amounts", () => {
    expect(centsToEuroString(1_000_000)).toBe("10000.00");
  });
});

// ─── HTTP mocking helper ──────────────────────────────────────────────────────

function mockFetch(response: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(response),
  } as Response);
}

// ─── findCustomerByEmail ──────────────────────────────────────────────────────

describe("findCustomerByEmail", () => {
  it("returns the first matching customer", async () => {
    const customer = { id: 42, name: "Jean Dupont", emails: ["jean@example.com"] };
    mockFetch({ items: [customer] });

    const result = await findCustomerByEmail("jean@example.com");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(customer);
  });

  it("returns null when no customer found", async () => {
    mockFetch({ items: [] });

    const result = await findCustomerByEmail("nobody@example.com");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it("handles v1 legacy 'customers' key in response", async () => {
    const customer = { id: 7, name: "Marie Martin", emails: ["marie@example.com"] };
    mockFetch({ customers: [customer] });

    const result = await findCustomerByEmail("marie@example.com");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data?.id).toBe(7);
  });

  it("returns error on HTTP failure", async () => {
    mockFetch({ error: "Unauthorized" }, 401);

    const result = await findCustomerByEmail("test@example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("401");
  });

  it("returns error on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network down"));
    const result = await findCustomerByEmail("test@example.com");
    expect(result.ok).toBe(false);
  });
});

// ─── createCompanyCustomer ────────────────────────────────────────────────────

describe("createCompanyCustomer", () => {
  it("creates a company customer and returns it", async () => {
    const customer = { id: 99, name: "ACME SAS", emails: ["billing@acme.fr"] };
    mockFetch(customer);

    const result = await createCompanyCustomer({
      name: "ACME SAS",
      emails: ["billing@acme.fr"],
      billing_address: { address: "1 rue de la Paix", postal_code: "75001", city: "Paris", country_alpha2: "FR" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(99);
  });

  it("returns error when API response has no id", async () => {
    mockFetch({});

    const result = await createCompanyCustomer({
      name: "Bad Corp",
      emails: ["x@y.com"],
      billing_address: { address: "—", postal_code: "00000", city: "—", country_alpha2: "FR" },
    });

    expect(result.ok).toBe(false);
  });
});

// ─── createIndividualCustomer ─────────────────────────────────────────────────

describe("createIndividualCustomer", () => {
  it("creates an individual customer", async () => {
    const customer = { id: 5, name: "Alice Doe", emails: ["alice@example.com"] };
    mockFetch(customer);

    const result = await createIndividualCustomer({
      first_name: "Alice",
      last_name: "Doe",
      emails: ["alice@example.com"],
      billing_address: { address: "—", postal_code: "00000", city: "—", country_alpha2: "FR" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("Alice Doe");
  });
});

// ─── getOrCreateCustomer ─────────────────────────────────────────────────────

describe("getOrCreateCustomer", () => {
  it("returns existing customer when found", async () => {
    const customer = { id: 1, name: "Existing User", emails: ["exist@example.com"] };
    mockFetch({ items: [customer] });

    const result = await getOrCreateCustomer({ email: "exist@example.com" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(1);
  });

  it("creates individual customer when not found and no company name", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ items: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: 10, name: "New User", emails: ["new@example.com"] }) } as Response);

    const result = await getOrCreateCustomer({ email: "new@example.com", name: "New User" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(10);
    fetchSpy.mockRestore();
  });

  it("creates company customer when companyName is provided", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ items: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ id: 20, name: "Big Corp", emails: ["admin@bigcorp.fr"] }) } as Response);

    const result = await getOrCreateCustomer({
      email: "admin@bigcorp.fr",
      companyName: "Big Corp",
      vatNumber: "FR12345678901",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(20);
    fetchSpy.mockRestore();
  });
});

// ─── createAndFinalizeInvoice ─────────────────────────────────────────────────

describe("createAndFinalizeInvoice", () => {
  const lines = [
    { label: "Sticker vinyl 50×50mm", quantity: 100, raw_currency_unit_price: "0.50", vat_rate: "FR_200", unit: "unité" },
  ];

  it("creates and returns a finalized invoice", async () => {
    const invoice = {
      id: 1001,
      invoice_number: "FA-2026-0001",
      status: "finalized",
      pdf_invoice_url: "https://pennylane.test/invoices/1001.pdf",
    };
    mockFetch(invoice, 201);

    const result = await createAndFinalizeInvoice({
      customerId: 42,
      date: "2026-04-27",
      deadline: "2026-04-27",
      lines,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.invoice_number).toBe("FA-2026-0001");
      expect(result.data.pdf_invoice_url).toBe("https://pennylane.test/invoices/1001.pdf");
    }
  });

  it("handles v1 legacy response wrapper {invoice: {...}}", async () => {
    const wrapped = {
      invoice: {
        id: 2002,
        invoice_number: "FA-2026-0002",
        status: "finalized",
        pdf_invoice_url: "https://pennylane.test/invoices/2002.pdf",
      },
    };
    mockFetch(wrapped, 201);

    const result = await createAndFinalizeInvoice({
      customerId: 1,
      date: "2026-04-27",
      deadline: "2026-04-27",
      lines,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(2002);
  });

  it("returns error when API responds with 422", async () => {
    mockFetch({ error: "Invalid lines" }, 422);

    const result = await createAndFinalizeInvoice({
      customerId: 1,
      date: "2026-04-27",
      deadline: "2026-04-27",
      lines,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("422");
  });

  it("returns error when response has no id", async () => {
    mockFetch({ status: "ok" }, 201);

    const result = await createAndFinalizeInvoice({
      customerId: 1,
      date: "2026-04-27",
      deadline: "2026-04-27",
      lines,
    });

    expect(result.ok).toBe(false);
  });
});

// ─── getInvoicePdfUrl ─────────────────────────────────────────────────────────

describe("getInvoicePdfUrl", () => {
  it("returns the public_file_url when available", async () => {
    mockFetch({ id: 1, public_file_url: "https://pennylane.test/public/1001.pdf" });

    const result = await getInvoicePdfUrl(1001);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.invoiceUrl).toBe("https://pennylane.test/public/1001.pdf");
  });

  it("falls back to file_url when public_file_url is null", async () => {
    mockFetch({ id: 1, public_file_url: null, file_url: "https://pennylane.test/files/1001.pdf" });

    const result = await getInvoicePdfUrl(1001);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.invoiceUrl).toBe("https://pennylane.test/files/1001.pdf");
  });

  it("returns invoiceUrl=null when all URL fields are absent", async () => {
    mockFetch({ id: 1 });

    const result = await getInvoicePdfUrl(1001);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.invoiceUrl).toBeNull();
  });
});

// ─── createCreditNote ─────────────────────────────────────────────────────────

describe("createCreditNote", () => {
  it("creates a credit note with negative amount", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({ id: 500, invoice_number: "AV-2026-0001", public_file_url: "https://pennylane.test/av/500.pdf" }),
    } as Response);

    const result = await createCreditNote({
      customerId: 42,
      creditedInvoiceId: 1001,
      amountCentsTTC: 1200,
      vatRate: 0.2,
      date: "2026-04-27",
      description: "Remboursement partiel",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.invoice_number).toBe("AV-2026-0001");
      expect(result.data.public_file_url).toBe("https://pennylane.test/av/500.pdf");
    }

    // Verify the body sends a negative amount
    const call = fetchSpy.mock.calls[0];
    const body = JSON.parse(call?.[1]?.body as string) as { invoice_lines: Array<{ raw_currency_unit_price: string }> };
    const unitPrice = parseFloat(body.invoice_lines[0]?.raw_currency_unit_price ?? "0");
    expect(unitPrice).toBeLessThan(0);

    fetchSpy.mockRestore();
  });

  it("returns error when API fails", async () => {
    mockFetch({ error: "Not found" }, 404);

    const result = await createCreditNote({
      customerId: 1,
      creditedInvoiceId: 999,
      amountCentsTTC: 500,
      vatRate: 0.2,
      date: "2026-04-27",
    });

    expect(result.ok).toBe(false);
  });
});
