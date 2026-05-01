import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  real,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { EmailBlock } from "@/lib/email-blocks";
import type { AppliedDiscountSnapshot, DiscountConditions, DiscountCombinationRules, DiscountEligibility } from "@/lib/discounts/discount-types";

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
    tags: text("tags").array().notNull().default([]),
    notes: text("notes"),
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
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    tagline: varchar("tagline", { length: 500 }),
    features: text("features").array(),
    imageUrl: text("image_url"),
    images: jsonb("images").$type<string[]>().default([]),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    productFamily: varchar("product_family", { length: 50 }).notNull().default("sticker"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    sku: varchar("sku", { length: 100 }),
    gtin: varchar("gtin", { length: 50 }),
    mpn: varchar("mpn", { length: 100 }),
    brand: varchar("brand", { length: 255 }).notNull().default("MS Adhésif"),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: text("seo_description"),
    reviewsEnabled: boolean("reviews_enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("products_slug_idx").on(t.slug)],
);

// product_variants removed — replaced by product_sticker_configs

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
    // Discounts
    discountCents: integer("discount_cents").notNull().default(0),
    discountCode: varchar("discount_code", { length: 100 }),
    appliedDiscounts: jsonb("applied_discounts").$type<AppliedDiscountSnapshot[]>().default([]),
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
    quantity: integer("quantity").notNull(),
    widthMm: integer("width_mm"),
    heightMm: integer("height_mm"),
    shape: varchar("shape", { length: 30 }),
    finish: varchar("finish", { length: 20 }),
    options: jsonb("options").default({}),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    customizationNote: text("customization_note"),
    stickerConfig: jsonb("sticker_config").$type<StickerConfigSnapshot>(),
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

// ─── discounts ────────────────────────────────────────────────────────────────

export const discounts = pgTable(
  "discounts",
  {
    id:                     uuid("id").primaryKey().defaultRandom(),
    title:                  varchar("title", { length: 255 }).notNull(),
    internalName:           varchar("internal_name", { length: 255 }),
    code:                   varchar("code", { length: 100 }).unique(),
    method:                 varchar("method", { length: 20 }).notNull(), // 'CODE' | 'AUTOMATIC'
    type:                   varchar("type", { length: 30 }).notNull(),   // 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'
    target:                 varchar("target", { length: 20 }).notNull().default("ORDER"), // 'ORDER' | 'SHIPPING'
    value:                  integer("value"),   // % as integer for PERCENTAGE, cents for FIXED_AMOUNT
    status:                 varchar("status", { length: 30 }).notNull().default("ACTIVE"),
    startsAt:               timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt:                 timestamp("ends_at", { withTimezone: true }),
    priority:               integer("priority").notNull().default(0),
    usageCount:             integer("usage_count").notNull().default(0),
    globalUsageLimit:       integer("global_usage_limit"),
    usageLimitPerCustomer:  integer("usage_limit_per_customer"),
    conditions:             jsonb("conditions").notNull().$type<DiscountConditions>().default({} as DiscountConditions),
    eligibility:            jsonb("eligibility").notNull().$type<DiscountEligibility>().default({ customerEligibility: "ALL" }),
    combinationRules:       jsonb("combination_rules").notNull().$type<DiscountCombinationRules>().default({ combinableWithOrderDiscounts: false, combinableWithOtherCodes: false, combinableWithShippingDiscounts: true, combinableWithAutomaticDiscounts: true }),
    ...timestamps,
  },
  (t) => [
    index("discounts_code_idx").on(t.code),
    index("discounts_method_status_idx").on(t.method, t.status),
  ],
);

export type Discount = typeof discounts.$inferSelect;
export type NewDiscount = typeof discounts.$inferInsert;

// ─── discount_usages ──────────────────────────────────────────────────────────

export const discountUsages = pgTable(
  "discount_usages",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    discountId:     uuid("discount_id").notNull().references(() => discounts.id, { onDelete: "cascade" }),
    customerId:     text("customer_id").references(() => users.id, { onDelete: "set null" }),
    orderId:        uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    code:           varchar("code", { length: 100 }),
    discountCents:  integer("discount_cents").notNull(),
    usedAt:         timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discount_usages_discount_id_idx").on(t.discountId),
    index("discount_usages_customer_id_idx").on(t.customerId),
    index("discount_usages_order_id_idx").on(t.orderId),
  ],
);

export type DiscountUsage = typeof discountUsages.$inferSelect;

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type NewOrderEvent = typeof orderEvents.$inferInsert;
export type OrderFile = typeof orderFiles.$inferSelect;
export type ShippingRate = typeof shippingRates.$inferSelect;

// product_option_values removed — replaced by sticker catalog tables

// ─── site_settings ─────────────────────────────────────────────────────────────

// ─── nav_items ─────────────────────────────────────────────────────────────────

export const navItems = pgTable(
  "nav_items",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    parentId:     uuid("parent_id").references((): AnyPgColumn => navItems.id, { onDelete: "cascade" }),
    label:        varchar("label", { length: 100 }).notNull(),
    href:         varchar("href", { length: 500 }).notNull().default("#"),
    icon:         varchar("icon", { length: 20 }),
    description:  varchar("description", { length: 255 }),
    badge:        varchar("badge", { length: 50 }),
    openInNewTab: boolean("open_in_new_tab").notNull().default(false),
    active:       boolean("active").notNull().default(true),
    sortOrder:    integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("nav_items_parent_sort_idx").on(t.parentId, t.sortOrder)],
);

export type NavItem = typeof navItems.$inferSelect;

// ─── pages (CMS) ───────────────────────────────────────────────────────────────

export const pages = pgTable("pages", {
  id:              uuid("id").primaryKey().defaultRandom(),
  slug:            varchar("slug", { length: 100 }).notNull().unique(),
  title:           varchar("title", { length: 255 }).notNull(),
  metaTitle:       varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  sections:        jsonb("sections").notNull().default([]),
  published:       boolean("published").notNull().default(true),
  ...timestamps,
});

export type Page = typeof pages.$inferSelect;

// ─── site_settings ─────────────────────────────────────────────────────────────

export const siteSettings = pgTable("site_settings", {
  id:                    integer("id").primaryKey().default(1),
  logoUrl:               text("logo_url"),
  maintenanceEnabled:    boolean("maintenance_enabled").notNull().default(false),
  maintenanceTitle:      varchar("maintenance_title", { length: 255 }).notNull().default("Bientôt disponible"),
  maintenanceMessage:    text("maintenance_message").notNull().default("Notre site est en cours de mise à jour. Revenez très vite !"),
  maintenanceEmail:      varchar("maintenance_email", { length: 255 }).notNull().default("hello@msadhesif.fr"),
  maintenancePhone:      varchar("maintenance_phone", { length: 50 }).notNull().default(""),
  contactEmail:                  varchar("contact_email", { length: 255 }).notNull().default("hello@msadhesif.fr"),
  standardShippingCents:         integer("standard_shipping_cents").notNull().default(490),
  expressShippingCents:          integer("express_shipping_cents").notNull().default(990),
  freeShippingThresholdCents:    integer("free_shipping_threshold_cents").notNull().default(5000),
  quantityStep:                  integer("quantity_step").notNull().default(25),
  updatedAt:                     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteSettings = typeof siteSettings.$inferSelect;

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const reviewStatusEnum = pgEnum("review_status", ["pending", "published", "rejected", "archived"]);
export const reviewVerificationStatusEnum = pgEnum("review_verification_status", ["verified_purchase", "unverified", "manual_verified", "imported"]);
export const reviewSourceEnum = pgEnum("review_source", ["post_purchase_email", "manual_request", "onsite_form", "import", "admin"]);
export const reviewTypeEnum = pgEnum("review_type", ["product", "store"]);
export const reviewRequestStatusEnum = pgEnum("review_request_status", ["scheduled", "sent", "opened", "clicked", "submitted", "expired", "cancelled"]);
export const reviewRequestTypeEnum = pgEnum("review_request_type", ["product", "store", "combined"]);
export const reviewMediaTypeEnum = pgEnum("review_media_type", ["image", "video"]);
export const reviewMediaStatusEnum = pgEnum("review_media_status", ["pending", "approved", "rejected"]);
export const reviewRequestItemStatusEnum = pgEnum("review_request_item_status", ["pending", "submitted", "skipped"]);

export const reviews = pgTable(
  "reviews",
  {
    id:                 uuid("id").primaryKey().defaultRandom(),
    type:               reviewTypeEnum("type").notNull(),
    rating:             integer("rating").notNull(),
    title:              varchar("title", { length: 255 }),
    body:               text("body"),
    status:             reviewStatusEnum("status").notNull().default("pending"),
    verificationStatus: reviewVerificationStatusEnum("verification_status").notNull().default("unverified"),
    productId:          uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    orderId:            uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    orderItemId:        uuid("order_item_id").references(() => orderItems.id, { onDelete: "set null" }),
    customerId:         text("customer_id").references(() => users.id, { onDelete: "set null" }),
    customerEmail:      varchar("customer_email", { length: 320 }).notNull(),
    customerName:       varchar("customer_name", { length: 255 }),
    displayName:        varchar("display_name", { length: 255 }),
    source:             reviewSourceEnum("source").notNull().default("post_purchase_email"),
    locale:             varchar("locale", { length: 10 }).default("fr"),
    country:            varchar("country", { length: 10 }).notNull().default("FR"),
    helpfulCount:       integer("helpful_count").notNull().default(0),
    notHelpfulCount:    integer("not_helpful_count").notNull().default(0),
    publishedAt:        timestamp("published_at", { withTimezone: true }),
    rejectedAt:         timestamp("rejected_at", { withTimezone: true }),
    rejectionReason:    text("rejection_reason"),
    ...timestamps,
  },
  (t) => [
    index("reviews_product_id_idx").on(t.productId),
    index("reviews_order_id_idx").on(t.orderId),
    index("reviews_customer_email_idx").on(t.customerEmail),
    index("reviews_status_idx").on(t.status),
    index("reviews_type_idx").on(t.type),
  ],
);

export const reviewMedia = pgTable(
  "review_media",
  {
    id:                  uuid("id").primaryKey().defaultRandom(),
    reviewId:            uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
    type:                reviewMediaTypeEnum("type").notNull(),
    url:                 text("url").notNull(),
    thumbnailUrl:        text("thumbnail_url"),
    storageKey:          text("storage_key").notNull(),
    status:              reviewMediaStatusEnum("status").notNull().default("pending"),
    altText:             text("alt_text"),
    caption:             text("caption"),
    consentForMarketing: boolean("consent_for_marketing").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("review_media_review_id_idx").on(t.reviewId),
    index("review_media_status_idx").on(t.status),
  ],
);

export const reviewRequests = pgTable(
  "review_requests",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    orderId:          uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    customerId:       text("customer_id").references(() => users.id, { onDelete: "set null" }),
    customerEmail:    varchar("customer_email", { length: 320 }).notNull(),
    type:             reviewRequestTypeEnum("type").notNull().default("combined"),
    tokenHash:        varchar("token_hash", { length: 64 }).notNull().unique(),
    status:           reviewRequestStatusEnum("status").notNull().default("scheduled"),
    sendAt:           timestamp("send_at", { withTimezone: true }).notNull(),
    sentAt:           timestamp("sent_at", { withTimezone: true }),
    firstOpenedAt:    timestamp("first_opened_at", { withTimezone: true }),
    firstClickedAt:   timestamp("first_clicked_at", { withTimezone: true }),
    submittedAt:      timestamp("submitted_at", { withTimezone: true }),
    expiresAt:        timestamp("expires_at", { withTimezone: true }).notNull(),
    reminderCount:    integer("reminder_count").notNull().default(0),
    nextReminderAt:   timestamp("next_reminder_at", { withTimezone: true }),
    locale:           varchar("locale", { length: 10 }).default("fr"),
    ...timestamps,
  },
  (t) => [
    index("review_requests_order_id_idx").on(t.orderId),
    index("review_requests_customer_email_idx").on(t.customerEmail),
    index("review_requests_status_idx").on(t.status),
    index("review_requests_send_at_idx").on(t.sendAt),
  ],
);

export const reviewRequestItems = pgTable(
  "review_request_items",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    reviewRequestId: uuid("review_request_id").notNull().references(() => reviewRequests.id, { onDelete: "cascade" }),
    productId:       uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    orderItemId:     uuid("order_item_id").references(() => orderItems.id, { onDelete: "set null" }),
    status:          reviewRequestItemStatusEnum("status").notNull().default("pending"),
    reviewId:        uuid("review_id").references(() => reviews.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("review_request_items_request_id_idx").on(t.reviewRequestId),
    index("review_request_items_product_id_idx").on(t.productId),
  ],
);

export const reviewAttributes = pgTable(
  "review_attributes",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    reviewId:  uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
    key:       varchar("key", { length: 100 }).notNull(),
    label:     varchar("label", { length: 255 }).notNull(),
    value:     varchar("value", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("review_attributes_review_id_idx").on(t.reviewId),
    index("review_attributes_key_idx").on(t.key),
  ],
);

export const reviewAggregates = pgTable(
  "review_aggregates",
  {
    id:                  uuid("id").primaryKey().defaultRandom(),
    targetType:          reviewTypeEnum("target_type").notNull(),
    targetId:            uuid("target_id"),
    averageRating:       real("average_rating").notNull().default(0),
    reviewCount:         integer("review_count").notNull().default(0),
    rating1Count:        integer("rating1_count").notNull().default(0),
    rating2Count:        integer("rating2_count").notNull().default(0),
    rating3Count:        integer("rating3_count").notNull().default(0),
    rating4Count:        integer("rating4_count").notNull().default(0),
    rating5Count:        integer("rating5_count").notNull().default(0),
    mediaReviewCount:    integer("media_review_count").notNull().default(0),
    verifiedReviewCount: integer("verified_review_count").notNull().default(0),
    updatedAt:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("review_aggregates_target_idx").on(t.targetType, t.targetId),
    index("review_aggregates_target_type_idx").on(t.targetType),
  ],
);

export const reviewEmailPreferences = pgTable(
  "review_email_preferences",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    customerEmail: varchar("customer_email", { length: 320 }).notNull().unique(),
    customerId:    text("customer_id").references(() => users.id, { onDelete: "set null" }),
    optedOut:      boolean("opted_out").notNull().default(false),
    optedOutAt:    timestamp("opted_out_at", { withTimezone: true }),
    ...timestamps,
  },
);

export const reviewReplies = pgTable(
  "review_replies",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    reviewId:    uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }).unique(),
    body:        text("body").notNull(),
    status:      varchar("status", { length: 20 }).notNull().default("published"),
    ...timestamps,
  },
  (t) => [index("review_replies_review_id_idx").on(t.reviewId)],
);

export const reviewSettings = pgTable("review_settings", {
  id:                               integer("id").primaryKey().default(1),
  autoPublish:                      boolean("auto_publish").notNull().default(false),
  autoPublishMinRating:             integer("auto_publish_min_rating"),
  requestDelayDaysAfterFulfillment: integer("request_delay_days_after_fulfillment").notNull().default(7),
  requestExpiresAfterDays:          integer("request_expires_after_days").notNull().default(60),
  remindersEnabled:                 boolean("reminders_enabled").notNull().default(true),
  firstReminderDelayDays:           integer("first_reminder_delay_days").notNull().default(5),
  secondReminderDelayDays:          integer("second_reminder_delay_days"),
  maxReminderCount:                 integer("max_reminder_count").notNull().default(2),
  collectStoreReview:               boolean("collect_store_review").notNull().default(true),
  collectProductReviews:            boolean("collect_product_reviews").notNull().default(true),
  collectMedia:                     boolean("collect_media").notNull().default(true),
  requireModerationForMedia:        boolean("require_moderation_for_media").notNull().default(true),
  requireModerationForLowRating:    boolean("require_moderation_for_low_rating").notNull().default(true),
  lowRatingThreshold:               integer("low_rating_threshold").notNull().default(3),
  displayReviewerLastName:          boolean("display_reviewer_last_name").notNull().default(false),
  displayVerifiedBadge:             boolean("display_verified_badge").notNull().default(true),
  updatedAt:                        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type ReviewMedia = typeof reviewMedia.$inferSelect;
export type ReviewRequest = typeof reviewRequests.$inferSelect;
export type NewReviewRequest = typeof reviewRequests.$inferInsert;
export type ReviewRequestItem = typeof reviewRequestItems.$inferSelect;
export type ReviewAggregate = typeof reviewAggregates.$inferSelect;
export type ReviewSettings = typeof reviewSettings.$inferSelect;

// ─── Shipping Engine ──────────────────────────────────────────────────────────

export const shippingMethodTypeEnum = pgEnum("shipping_method_type", [
  "carrier", "local_delivery", "pickup", "relay_point", "custom", "freight",
]);

export const shippingMethods = pgTable("shipping_methods", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  name:                varchar("name", { length: 255 }).notNull(),
  publicName:          varchar("public_name", { length: 255 }).notNull(),
  description:         text("description"),
  type:                shippingMethodTypeEnum("type").notNull().default("carrier"),
  isActive:            boolean("is_active").notNull().default(true),
  isDefault:           boolean("is_default").notNull().default(false),
  basePriceCents:      integer("base_price_cents").notNull().default(0),
  currency:            varchar("currency", { length: 3 }).notNull().default("EUR"),
  minDeliveryDays:     integer("min_delivery_days"),
  maxDeliveryDays:     integer("max_delivery_days"),
  carrierCode:         varchar("carrier_code", { length: 100 }),
  carrierServiceCode:  varchar("carrier_service_code", { length: 100 }),
  supportsTracking:    boolean("supports_tracking").notNull().default(false),
  supportsRelayPoint:  boolean("supports_relay_point").notNull().default(false),
  supportsPickup:      boolean("supports_pickup").notNull().default(false),
  supportsDeliveryDate: boolean("supports_delivery_date").notNull().default(false),
  supportsTimeSlot:    boolean("supports_time_slot").notNull().default(false),
  displayOrder:        integer("display_order").notNull().default(0),
  ...timestamps,
});

export const shippingZones = pgTable("shipping_zones", {
  id:          uuid("id").primaryKey().defaultRandom(),
  name:        varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  countries:   jsonb("countries").notNull().default([]).$type<string[]>(),
  regions:     jsonb("regions").notNull().default([]).$type<string[]>(),
  cities:      jsonb("cities").notNull().default([]).$type<string[]>(),
  geoRadius:   jsonb("geo_radius").$type<{ enabled: boolean; originLat: number; originLng: number; radiusKm: number } | null>(),
  isActive:    boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const shippingZonePostalRules = pgTable(
  "shipping_zone_postal_rules",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    zoneId:    uuid("zone_id").notNull().references(() => shippingZones.id, { onDelete: "cascade" }),
    type:      varchar("type", { length: 20 }).notNull().$type<"exact" | "prefix" | "range" | "regex" | "exclude">(),
    value:     varchar("value", { length: 255 }).notNull(),
    fromValue: varchar("from_value", { length: 255 }),
    toValue:   varchar("to_value", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shipping_zone_postal_rules_zone_id_idx").on(t.zoneId)],
);

export const shippingRules = pgTable(
  "shipping_rules",
  {
    id:                       uuid("id").primaryKey().defaultRandom(),
    name:                     varchar("name", { length: 255 }).notNull(),
    description:              text("description"),
    isActive:                 boolean("is_active").notNull().default(true),
    priority:                 integer("priority").notNull().default(100),
    startsAt:                 timestamp("starts_at", { withTimezone: true }),
    endsAt:                   timestamp("ends_at", { withTimezone: true }),
    conditionRoot:            jsonb("condition_root").notNull().default({ logic: "AND", conditions: [], groups: [] }).$type<Record<string, unknown>>(),
    actions:                  jsonb("actions").notNull().default([]).$type<Record<string, unknown>[]>(),
    stopProcessingAfterMatch: boolean("stop_processing_after_match").notNull().default(false),
    combinableWithOtherRules: boolean("combinable_with_other_rules").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("shipping_rules_priority_idx").on(t.priority),
    index("shipping_rules_active_idx").on(t.isActive),
  ],
);

export const orderShippingSnapshots = pgTable(
  "order_shipping_snapshots",
  {
    id:                 uuid("id").primaryKey().defaultRandom(),
    orderId:            uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    selectedMethodId:   varchar("selected_method_id", { length: 255 }),
    selectedMethodName: varchar("selected_method_name", { length: 255 }),
    basePriceCents:     integer("base_price_cents").notNull().default(0),
    finalPriceCents:    integer("final_price_cents").notNull().default(0),
    currency:           varchar("currency", { length: 3 }).notNull().default("EUR"),
    appliedRulesJson:   jsonb("applied_rules_json").notNull().default([]).$type<Record<string, unknown>[]>(),
    hiddenMethodsJson:  jsonb("hidden_methods_json").notNull().default([]).$type<Record<string, unknown>[]>(),
    destinationJson:    jsonb("destination_json").notNull().default({}).$type<Record<string, unknown>>(),
    cartSnapshotJson:   jsonb("cart_snapshot_json").notNull().default({}).$type<Record<string, unknown>>(),
    createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_shipping_snapshots_order_id_idx").on(t.orderId)],
);

// Phase 3 tables

export const shippingPickupLocations = pgTable("shipping_pickup_locations", {
  id:            uuid("id").primaryKey().defaultRandom(),
  name:          varchar("name", { length: 255 }).notNull(),
  addressLine1:  varchar("address_line1", { length: 255 }),
  addressLine2:  varchar("address_line2", { length: 255 }),
  city:          varchar("city", { length: 100 }),
  postalCode:    varchar("postal_code", { length: 20 }),
  countryCode:   varchar("country_code", { length: 10 }).notNull().default("FR"),
  phone:         varchar("phone", { length: 50 }),
  instructions:  text("instructions"),
  hoursJson:     jsonb("hours_json").notNull().default({}).$type<Record<string, string>>(),
  daysAvailable: jsonb("days_available").notNull().default([1, 2, 3, 4, 5]).$type<number[]>(),
  prepDelayDays: integer("prep_delay_days").notNull().default(1),
  slotCapacity:  integer("slot_capacity").notNull().default(0),
  isActive:      boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const shippingTimeSlots = pgTable(
  "shipping_time_slots",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    methodId:        uuid("method_id").references(() => shippingMethods.id, { onDelete: "cascade" }),
    label:           varchar("label", { length: 100 }).notNull(),
    startTime:       varchar("start_time", { length: 5 }).notNull(),
    endTime:         varchar("end_time", { length: 5 }).notNull(),
    daysOfWeek:      jsonb("days_of_week").notNull().default([1, 2, 3, 4, 5]).$type<number[]>(),
    maxCapacity:     integer("max_capacity").notNull().default(0),
    extraPriceCents: integer("extra_price_cents").notNull().default(0),
    isActive:        boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("shipping_time_slots_method_id_idx").on(t.methodId)],
);

export const shippingBlackoutDates = pgTable(
  "shipping_blackout_dates",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    date:             varchar("date", { length: 10 }).notNull(),
    reason:           varchar("reason", { length: 255 }),
    affectsMethodIds: jsonb("affects_method_ids").notNull().default([]).$type<string[]>(),
    isRecurring:      boolean("is_recurring").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("shipping_blackout_dates_date_idx").on(t.date)],
);

export type ShippingMethod = typeof shippingMethods.$inferSelect;
export type NewShippingMethod = typeof shippingMethods.$inferInsert;
export type ShippingZone = typeof shippingZones.$inferSelect;
export type NewShippingZone = typeof shippingZones.$inferInsert;
export type ShippingZonePostalRule = typeof shippingZonePostalRules.$inferSelect;
export type ShippingRule = typeof shippingRules.$inferSelect;
export type NewShippingRule = typeof shippingRules.$inferInsert;
export type OrderShippingSnapshot = typeof orderShippingSnapshots.$inferSelect;
export type ShippingPickupLocation = typeof shippingPickupLocations.$inferSelect;
export type ShippingTimeSlot = typeof shippingTimeSlots.$inferSelect;
export type ShippingBlackoutDate = typeof shippingBlackoutDates.$inferSelect;

// ─── Sticker Catalog ──────────────────────────────────────────────────────────

export type StickerPriceModifierType = "none" | "fixed" | "percentage" | "multiplier";

export const stickerShapes = pgTable(
  "sticker_shapes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isStandardShape: boolean("is_standard_shape").notNull().default(true),
    requiresCutPath: boolean("requires_cut_path").notNull().default(false),
    priceModifierType: varchar("price_modifier_type", { length: 20 }).notNull().$type<StickerPriceModifierType>().default("none"),
    priceModifierValue: real("price_modifier_value").notNull().default(1),
    iconSvg: text("icon_svg"),
    isActive: boolean("is_active").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("sticker_shapes_code_idx").on(t.code)],
);

export const stickerSizes = pgTable(
  "sticker_sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: varchar("label", { length: 100 }).notNull(),
    widthMm: integer("width_mm").notNull(),
    heightMm: integer("height_mm").notNull(),
    isPreset: boolean("is_preset").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    minQuantity: integer("min_quantity"),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
);

export const stickerMaterials = pgTable(
  "sticker_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isWaterproof: boolean("is_waterproof").notNull().default(true),
    isOutdoorCompatible: boolean("is_outdoor_compatible").notNull().default(false),
    isTransparent: boolean("is_transparent").notNull().default(false),
    isPremium: boolean("is_premium").notNull().default(false),
    priceModifierType: varchar("price_modifier_type", { length: 20 }).notNull().$type<StickerPriceModifierType>().default("multiplier"),
    priceModifierValue: real("price_modifier_value").notNull().default(1),
    compatibleLaminationCodes: text("compatible_lamination_codes").array().notNull().default([]),
    previewImageUrl: text("preview_image_url"),
    isActive: boolean("is_active").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("sticker_materials_code_idx").on(t.code)],
);

export const stickerLaminations = pgTable(
  "sticker_laminations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    priceModifierType: varchar("price_modifier_type", { length: 20 }).notNull().$type<StickerPriceModifierType>().default("multiplier"),
    priceModifierValue: real("price_modifier_value").notNull().default(1),
    compatibleMaterialCodes: text("compatible_material_codes").array().notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("sticker_laminations_code_idx").on(t.code)],
);

export const stickerCutTypes = pgTable(
  "sticker_cut_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    requiresCutPath: boolean("requires_cut_path").notNull().default(false),
    priceModifierType: varchar("price_modifier_type", { length: 20 }).notNull().$type<StickerPriceModifierType>().default("multiplier"),
    priceModifierValue: real("price_modifier_value").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("sticker_cut_types_code_idx").on(t.code)],
);

export type StickerQuantityTier = { minQty: number; discountPct: number };
export type StickerConfigSnapshot = {
  shapeId: string;
  shapeName: string;
  shapeCode: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
  materialId: string;
  materialName: string;
  laminationId?: string;
  laminationName?: string;
  cutTypeId: string;
  cutTypeName: string;
  customerNote?: string;
  pricingSnapshot: {
    pricePerCm2Cents: number;
    surfaceCm2: number;
    quantityDiscountPct: number;
    materialMultiplier: number;
    laminationMultiplier: number;
    cutTypeMultiplier: number;
    setupFeeCents: number;
    unitPriceCents: number;
    subtotalCents: number;
  };
};

export const productStickerConfigs = pgTable(
  "product_sticker_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .unique()
      .references(() => products.id, { onDelete: "cascade" }),
    enabledShapeIds: jsonb("enabled_shape_ids").$type<string[]>().notNull().default([]),
    enabledSizeIds: jsonb("enabled_size_ids").$type<string[]>().notNull().default([]),
    enabledMaterialIds: jsonb("enabled_material_ids").$type<string[]>().notNull().default([]),
    enabledLaminationIds: jsonb("enabled_lamination_ids").$type<string[]>().notNull().default([]),
    enabledCutTypeIds: jsonb("enabled_cut_type_ids").$type<string[]>().notNull().default([]),
    allowCustomWidth: boolean("allow_custom_width").notNull().default(false),
    allowCustomHeight: boolean("allow_custom_height").notNull().default(false),
    minWidthMm: integer("min_width_mm").notNull().default(20),
    maxWidthMm: integer("max_width_mm").notNull().default(1000),
    minHeightMm: integer("min_height_mm").notNull().default(20),
    maxHeightMm: integer("max_height_mm").notNull().default(1000),
    requireFileUpload: boolean("require_file_upload").notNull().default(true),
    allowedFileExtensions: text("allowed_file_extensions").array().notNull().default(["pdf", "ai", "eps", "svg", "png", "jpg", "jpeg"]),
    maxFileSizeMb: integer("max_file_size_mb").notNull().default(100),
    defaultShapeId: uuid("default_shape_id"),
    defaultMaterialId: uuid("default_material_id"),
    defaultLaminationId: uuid("default_lamination_id"),
    defaultCutTypeId: uuid("default_cut_type_id"),
    pricePerCm2Cents: integer("price_per_cm2_cents").notNull().default(150),
    quantityTiers: jsonb("quantity_tiers").$type<StickerQuantityTier[]>().notNull().default([]),
    setupFeeCents: integer("setup_fee_cents").notNull().default(0),
    minOrderCents: integer("min_order_cents").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("product_sticker_configs_product_id_idx").on(t.productId)],
);

export type StickerShape = typeof stickerShapes.$inferSelect;
export type NewStickerShape = typeof stickerShapes.$inferInsert;
export type StickerSize = typeof stickerSizes.$inferSelect;
export type NewStickerSize = typeof stickerSizes.$inferInsert;
export type StickerMaterial = typeof stickerMaterials.$inferSelect;
export type NewStickerMaterial = typeof stickerMaterials.$inferInsert;
export type StickerLamination = typeof stickerLaminations.$inferSelect;
export type NewStickerLamination = typeof stickerLaminations.$inferInsert;
export type StickerCutType = typeof stickerCutTypes.$inferSelect;
export type NewStickerCutType = typeof stickerCutTypes.$inferInsert;
export type ProductStickerConfig = typeof productStickerConfigs.$inferSelect;
export type NewProductStickerConfig = typeof productStickerConfigs.$inferInsert;
