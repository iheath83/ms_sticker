"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

const BASE_V3 = "https://panel.sendcloud.sc/api/v3";
const BASE_V2 = "https://panel.sendcloud.sc/api/v2";

async function requireAdmin(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Non authentifié");
  const [dbUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (dbUser?.role !== "admin") throw new Error("Non autorisé");
}

function authHeader() {
  const pub = process.env.SENDCLOUD_PUBLIC_KEY ?? "";
  const sec = process.env.SENDCLOUD_SECRET_KEY ?? "";
  return "Basic " + Buffer.from(`${pub}:${sec}`).toString("base64");
}

async function scFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `[SendCloud] ${res.status} — ${text}` };
    }
    return { ok: true, data: JSON.parse(text) as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau SendCloud" };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendCloudShippingMethod {
  id: number;
  name: string;
  carrier: string;
  shipping_option_code: string;
}

export interface SendCloudParcel {
  id: number;
  tracking_number: string;
  tracking_url: string;
  carrier: { code: string };
  status: { id: number; message: string };
}

// ─── Get shipping methods (v3 compat endpoint) ────────────────────────────────

interface ShippingMethodsResponse {
  shipping_methods: Array<{
    id: number;
    name: string;
    carrier: string;
    min_weight: string;
    max_weight: string;
  }>;
}

export async function getShippingMethods(
  countryCode = "FR",
): Promise<{ ok: true; data: SendCloudShippingMethod[] } | { ok: false; error: string }> {
  await requireAdmin();
  // Step 1: fetch v2 methods (names/carriers)
  const res = await scFetch<ShippingMethodsResponse>(
    `${BASE_V2}/shipping_methods?to_country=${countryCode}`,
  );
  if (!res.ok) return res;

  const methods = res.data.shipping_methods ?? [];
  if (methods.length === 0) return { ok: true, data: [] };

  // Step 2: map v2 IDs → v3 shipping_option_code via compat endpoint
  const ids = methods.map((m) => m.id);
  const compatRes = await scFetch<{ data: Record<string, string> }>(
    `${BASE_V3}/compat/shipping-options`,
    {
      method: "POST",
      body: JSON.stringify({ shipping_method_ids: ids }),
    },
  );
  const codeMap: Record<string, string> = compatRes.ok ? (compatRes.data.data ?? {}) : {};

  const result: SendCloudShippingMethod[] = methods
    .map((m) => ({
      id: m.id,
      name: m.name,
      carrier: m.carrier,
      shipping_option_code: codeMap[String(m.id)] ?? "",
    }))
    .filter((m) => m.shipping_option_code !== ""); // only keep methods with v3 codes

  // Deduplicate by option code + name to avoid showing 15 weight variants of the same product
  const seen = new Set<string>();
  const deduped = result.filter((m) => {
    const key = `${m.shipping_option_code}|${m.carrier}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { ok: true, data: deduped };
}

// ─── Fetch sender address ─────────────────────────────────────────────────────

interface SenderAddress {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  telephone: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  country: string;
}

async function getFromAddress(id?: number | undefined): Promise<Record<string, string> | null> {
  const res = await scFetch<{ sender_addresses: SenderAddress[] }>(`${BASE_V2}/user/addresses/sender`);
  if (!res.ok) return null;
  const addresses = res.data.sender_addresses ?? [];
  const addr = id ? addresses.find((a) => a.id === id) ?? addresses[0] : addresses[0];
  if (!addr) return null;
  return {
    name: addr.company_name || addr.contact_name,
    company_name: addr.company_name,
    address_line_1: addr.street,
    house_number: addr.house_number,
    postal_code: addr.postal_code,
    city: addr.city,
    country_code: addr.country,
    phone_number: addr.telephone,
    email: addr.email,
  };
}

export interface CreateParcelInput {
  name: string;
  company?: string;
  address: string;
  houseNumber?: string;
  city: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
  email: string;
  orderNumber: string;
  weightGrams: number;
  shippingOptionCode: string;
  fromAddressId?: number | undefined;
}

interface AnnounceResponse {
  data?: {
    id?: string;
    carrier?: { code?: string };
    parcels?: Array<{
      id?: number;
      tracking_number?: string;
      documents?: Array<{ type?: string; link?: string }>;
    }>;
  };
}

export async function createParcel(
  input: CreateParcelInput,
): Promise<{ ok: true; data: { id: number; tracking_number: string; carrier_code: string; label_url: string } } | { ok: false; error: string }> {
  await requireAdmin();
  // Fetch from_address from SendCloud sender addresses
  const fromAddress = await getFromAddress(input.fromAddressId);
  if (!fromAddress) return { ok: false, error: "[SendCloud] Adresse d'expéditeur introuvable — vérifiez SENDCLOUD_FROM_ADDRESS_ID" };

  const body = {
    to_address: {
      name: input.name,
      company_name: input.company ?? "",
      address_line_1: input.address,
      house_number: input.houseNumber ?? "",
      postal_code: input.postalCode,
      city: input.city,
      country_code: input.countryCode,
      phone_number: input.phone ?? "",
      email: input.email,
    },
    from_address: fromAddress,
    weight: (input.weightGrams / 1000).toFixed(3),
    ship_with: {
      type: "shipping_option_code",
      properties: {
        shipping_option_code: input.shippingOptionCode,
      },
    },
    external_reference: input.orderNumber,
  };

  const res = await scFetch<AnnounceResponse>(
    `${BASE_V3}/shipments/create-with-shipping-rules`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) return res;

  const d = res.data.data;
  const parcel = d?.parcels?.[0];
  if (parcel?.id) {
    const labelDoc = parcel.documents?.find((doc) => doc.type === "label");
    return {
      ok: true,
      data: {
        id: parcel.id,
        tracking_number: parcel.tracking_number ?? "",
        carrier_code: d?.carrier?.code ?? "",
        label_url: labelDoc?.link ?? `${BASE_V3}/parcels/${parcel.id}/documents/label`,
      },
    };
  }

  return { ok: false, error: `[SendCloud] Réponse inattendue : ${JSON.stringify(res.data)}` };
}

// ─── Get label PDF URL (v3) ───────────────────────────────────────────────────

export async function getLabelUrl(parcelId: number): Promise<string | null> {
  await requireAdmin();
  // v3 label URL is a direct authenticated download endpoint
  return `${BASE_V3}/parcels/${parcelId}/documents/label`;
}

// ─── Auto-create order in SendCloud "Imported Orders" (no label) ─────────────

export async function autoCreateSendCloudOrder(orderId: string): Promise<void> {
  await requireAdmin();
  const integrationId = process.env.SENDCLOUD_INTEGRATION_ID
    ? Number(process.env.SENDCLOUD_INTEGRATION_ID)
    : 576127; // fallback to the API integration ID

  // Lazy-import db to avoid edge runtime issues
  const { db } = await import("@/db");
  const { orders, addresses, users, orderItems, products } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const [row] = await db
    .select({ order: orders, userName: users.name, userEmail: users.email })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) return;
  if (row.order.sendcloudOrderId) return; // already created

  const { order } = row;
  if (!order.shippingAddressId) return;

  const [addr] = await db.select().from(addresses).where(eq(addresses.id, order.shippingAddressId)).limit(1);
  if (!addr) return;

  const email = row.userEmail ?? order.guestEmail ?? "";
  const name = [addr.firstName, addr.lastName].filter(Boolean).join(" ") || row.userName || email;

  // Fetch order items
  const items = await db
    .select({ item: orderItems, productName: products.name })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId));

  const orderItemPayload = items.map((i) => ({
    name: i.productName ?? "Produit",
    quantity: i.item.quantity,
    sku: i.item.productId ?? "SKU",
    unit_price: { value: (i.item.unitPriceCents / 100).toFixed(2), currency: "EUR" },
    total_price: { value: ((i.item.unitPriceCents * i.item.quantity) / 100).toFixed(2), currency: "EUR" },
  }));

  const orderNumber = orderId.slice(0, 8).toUpperCase();

  const body = [{
    order_id: orderId,
    order_number: orderNumber,
    shipping_address: {
      name,
      address_line_1: addr.line1,
      house_number: addr.line2 ?? "",
      postal_code: addr.postalCode,
      city: addr.city,
      country_code: addr.countryCode,
      phone_number: addr.phone ?? "",
      email,
    },
    order_details: {
      integration: { id: integrationId },
      order_created_at: new Date().toISOString(),
      order_items: orderItemPayload.length > 0 ? orderItemPayload : [{ name: "Commande", quantity: 1, sku: orderNumber, unit_price: { value: (order.totalCents / 100).toFixed(2), currency: "EUR" }, total_price: { value: (order.totalCents / 100).toFixed(2), currency: "EUR" } }],
      status: { code: "complete", message: "Complete" },
      notes: `Commande #${orderNumber} — msadhesif.fr`,
    },
    payment_details: {
      status: { code: "paid", message: "Paid" },
      total_price: { value: (order.totalCents / 100).toFixed(2), currency: "EUR" },
    },
  }];

  const res = await scFetch<{ data: Array<{ id: number; order_number: string }> }>(
    `${BASE_V3}/orders`,
    { method: "POST", body: JSON.stringify(body) },
  );

  if (!res.ok) {
    console.error(`[sendcloud] autoCreateSendCloudOrder failed for ${orderId}:`, res.error);
    return;
  }

  const scOrderId = String(res.data.data?.[0]?.id ?? "");

  if (scOrderId) {
    await db
      .update(orders)
      .set({ sendcloudOrderId: scOrderId, updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    const { orderEvents } = await import("@/db/schema");
    await db.insert(orderEvents).values({
      orderId,
      type: "sendcloud.order_created",
      actorId: null,
      payload: { sendcloudOrderId: scOrderId, orderNumber },
    });

    console.log(`[sendcloud] Order ${scOrderId} created in SendCloud imported orders for ${orderId}`);
  }
}
