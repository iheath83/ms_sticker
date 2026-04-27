import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { EmailBlock } from "@/lib/email-blocks";
import type { PricingTier, CustomPreset } from "@/lib/pricing";

// ─── Timestamps helper ───────────────────────────────────────────────────────

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["customer", "admin"]);

export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "proof_pending",
  "proof_sent",
  "proof_revision_requested",
  "approved",
  "paid",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
]);

export const orderFileTypeEnum = pgEnum("order_file_type", [
  "customer_upload",
  "proof",
  "final_artwork",
]);

// ─── users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // text — Better-Auth generates IDs
    email: varchar("email", { length: 320 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    phone: varchar("phone", { length: 30 }),
    role: userRoleEnum("role").notNull().default("customer"),
    // Better-Auth fields
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"), // profile picture URL (Better-Auth compatible)
    passwordHash: text("password_hash"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

// ─── accounts (Better-Auth — stores OAuth + credential passwords) ─────────────

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(), // text — Better-Auth manages IDs
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(), // "credential" | "google" | ...
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"), // hashed, for email/password
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

// ─── verifications (Better-Auth — email verification + password reset) ─────────

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(), // text — Better-Auth manages IDs
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── sessions (Better-Auth) ───────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // text — Better-Auth manages IDs
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  ...timestamps,
});

// ─── password_reset_tokens ────────────────────────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── addresses ───────────────────────────────────────────────────────────────

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 50 }), // e.g. "Maison", "Bureau"
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    line1: varchar("line1", { length: 255 }).notNull(),
    line2: varchar("line2", { length: 255 }),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    countryCode: varchar("country_code", { length: 10 }).notNull().default("FR"),
    phone: varchar("phone", { length: 30 }),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("addresses_user_id_idx").on(t.userId)],
);

// ─── customer_profiles ────────────────────────────────────────────────────────

export const customerProfiles = pgTable(
  "customer_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    isProfessional: boolean("is_professional").notNull().default(false),
    companyName: varchar("company_name", { length: 255 }),
    vatNumber: varchar("vat_number", { length: 30 }),
    siret: varchar("siret", { length: 14 }),
    billingAddressId: uuid("billing_address_id").references(() => addresses.id, {
      onDelete: "set null",
    }),
    defaultShippingAddressId: uuid("default_shipping_address_id").references(
      () => addresses.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (t) => [index("customer_profiles_user_id_idx").on(t.userId)],
);

// ─── categories ───────────────────────────────────────────────────────────────

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "set null" }),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug)],
);

// ─── products ─────────────────────────────────────────────────────────────────

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // New Shopify-like fields
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    tagline: varchar("tagline", { length: 500 }),
    features: text("features").array(),
    images: jsonb("images").$type<string[]>().default([]),
    requiresCustomization: boolean("requires_customization").notNull().default(true),
    // Original fields (kept for backward compat during migration)
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"), // Markdown
    basePriceCents: integer("base_price_cents").notNull(), // price for 50 units at 5×5cm
    material: varchar("material", { length: 50 }).notNull(), // vinyl | holographic | glitter | transparent
    minWidthMm: integer("min_width_mm").notNull().default(20),
    maxWidthMm: integer("max_width_mm").notNull().default(300),
    minHeightMm: integer("min_height_mm").notNull().default(20),
    maxHeightMm: integer("max_height_mm").notNull().default(300),
    shapes: text("shapes").array().notNull().default(["die-cut", "circle", "square"]),
    imageUrl: text("image_url"), // main product photo / hero image
    minQty: integer("min_qty").notNull().default(1),
    options: jsonb("options").default({}), // { holographic, glitter, uvLaminated, tiers, tagline, features, availableFinishes, availableSizes, availableMaterials }
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("products_slug_idx").on(t.slug)],
);

// ─── product_variants ─────────────────────────────────────────────────────────

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }).unique(),
    material: varchar("material", { length: 50 }).notNull(),
    availableFinishes: text("available_finishes").array().notNull().default(["gloss"]),
    shapes: text("shapes").array().notNull().default(["die-cut", "circle", "square"]),
    basePriceCents: integer("base_price_cents").notNull(),
    minQty: integer("min_qty").notNull().default(1),
    weightGrams: integer("weight_grams").notNull().default(100),
    minWidthMm: integer("min_width_mm").notNull().default(20),
    maxWidthMm: integer("max_width_mm").notNull().default(300),
    minHeightMm: integer("min_height_mm").notNull().default(20),
    maxHeightMm: integer("max_height_mm").notNull().default(300),
    tiers: jsonb("tiers").$type<PricingTier[]>(),
    sizePrices: jsonb("size_prices").$type<Record<string, number>>(),
    customPresets: jsonb("custom_presets").$type<CustomPreset[]>(),
    imageUrl: text("image_url"),
    images: jsonb("images").$type<string[]>().default([]),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("product_variants_product_id_idx").on(t.productId),
    uniqueIndex("product_variants_sku_idx").on(t.sku),
  ],
);

// ─── orders ───────────────────────────────────────────────────────────────────

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    // Guest info (before account creation)
    guestEmail: varchar("guest_email", { length: 320 }),
    status: orderStatusEnum("status").notNull().default("draft"),
    // Pricing (all in cents)
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxAmountCents: integer("tax_amount_cents").notNull().default(0),
    shippingCents: integer("shipping_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    // VAT
    vatRate: numeric("vat_rate", { precision: 5, scale: 4 }).notNull().default("0.2000"),
    vatReverseCharge: boolean("vat_reverse_charge").notNull().default(false),
    // Stripe
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    // Pennylane
    pennylaneCustomerId: varchar("pennylane_customer_id", { length: 100 }),
    pennylaneInvoiceId: varchar("pennylane_invoice_id", { length: 100 }),
    pennylaneInvoiceUrl: text("pennylane_invoice_url"),
    // SendCloud
    sendcloudParcelId: varchar("sendcloud_parcel_id", { length: 100 }),
    sendcloudOrderId: varchar("sendcloud_order_id", { length: 100 }),
    shippingLabelUrl: text("shipping_label_url"),
    // Addresses
    shippingAddressId: uuid("shipping_address_id").references(() => addresses.id, {
      onDelete: "set null",
    }),
    billingAddressId: uuid("billing_address_id").references(() => addresses.id, {
      onDelete: "set null",
    }),
    // Shipping method
    deliveryMethod: varchar("delivery_method", { length: 30 }),
    // Shipping tracking
    trackingNumber: varchar("tracking_number", { length: 100 }),
    trackingCarrier: varchar("tracking_carrier", { length: 50 }),
    // Notes
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    ...timestamps,
  },
  (t) => [
    index("orders_user_id_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_stripe_session_idx").on(t.stripeCheckoutSessionId),
  ],
);

// ─── order_items ──────────────────────────────────────────────────────────────

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    quantity: integer("quantity").notNull(),
    widthMm: integer("width_mm").notNull(),
    heightMm: integer("height_mm").notNull(),
    shape: varchar("shape", { length: 30 }).notNull(),
    finish: varchar("finish", { length: 20 }).notNull().default("gloss"),
    weightGrams: integer("weight_grams"), // snapshot of variant weight at order time
    options: jsonb("options").default({}),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    customizationNote: text("customization_note"),
    ...timestamps,
  },
  (t) => [
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_product_id_idx").on(t.productId),
  ],
);

// ─── order_files ──────────────────────────────────────────────────────────────

export const orderFiles = pgTable(
  "order_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "set null" }),
    type: orderFileTypeEnum("type").notNull(),
    version: integer("version").notNull().default(1),
    storageKey: text("storage_key").notNull(),
    mimeType: varchar("mime_type", { length: 100 }),
    sizeBytes: integer("size_bytes"),
    originalFilename: varchar("original_filename", { length: 255 }),
    uploadedById: text("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("order_files_order_id_idx").on(t.orderId)],
);

// ─── order_events (APPEND-ONLY — trigger enforced) ────────────────────────────

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 100 }).notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // No updatedAt — this table is append-only
  },
  (t) => [
    index("order_events_order_id_created_at_idx").on(t.orderId, t.createdAt),
  ],
);

// ─── shipping_rates ───────────────────────────────────────────────────────────

export const shippingRates = pgTable("shipping_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  countryCode: varchar("country_code", { length: 10 }).notNull(),
  method: varchar("method", { length: 50 }).notNull(), // standard | express
  priceCents: integer("price_cents").notNull(),
  etaDaysMin: integer("eta_days_min").notNull(),
  etaDaysMax: integer("eta_days_max").notNull(),
  freeAboveCents: integer("free_above_cents"), // free shipping threshold
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

// ─── webhook_events (Stripe idempotency) ─────────────────────────────────────

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 30 }).notNull(), // stripe | pennylane
    eventId: varchar("event_id", { length: 255 }).notNull(),
    type: varchar("type", { length: 100 }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload").default({}),
  },
  (t) => [uniqueIndex("webhook_events_provider_event_id_idx").on(t.provider, t.eventId)],
);

// ─── rate_limits (PostgreSQL-based, no Redis needed) ─────────────────────────

export const rateLimits = pgTable(
  "rate_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 255 }).notNull(), // e.g. "login:1.2.3.4"
    attempts: integer("attempts").notNull().default(1),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
  },
  (t) => [uniqueIndex("rate_limits_key_idx").on(t.key)],
);

// ─── vies_cache (VAT validation cache) ───────────────────────────────────────

export const viesCache = pgTable(
  "vies_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vatNumber: varchar("vat_number", { length: 30 }).notNull(),
    countryCode: varchar("country_code", { length: 5 }).notNull(),
    valid: boolean("valid").notNull(),
    companyName: varchar("company_name", { length: 255 }),
    companyAddress: text("company_address"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("vies_cache_vat_number_idx").on(t.vatNumber)],
);

// ─── email_templates ──────────────────────────────────────────────────────────

export const EMAIL_TEMPLATE_TYPES = [
  "order-received",
  "proof-ready",
  "proof-revision-acknowledged",
  "payment-received",
  "order-shipped",
  "admin-new-order",
  "bat-reply",
  "password-reset",
] as const;

export type EmailTemplateType = (typeof EMAIL_TEMPLATE_TYPES)[number];

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 60 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  blocks: jsonb("blocks").notNull().$type<EmailBlock[]>(),
  designJson: jsonb("design_json").$type<Record<string, unknown>>(),
  renderedHtml: text("rendered_html"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmailTemplateRow = typeof emailTemplates.$inferSelect;

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type NewOrderEvent = typeof orderEvents.$inferInsert;
export type OrderFile = typeof orderFiles.$inferSelect;
export type ShippingRate = typeof shippingRates.$inferSelect;
