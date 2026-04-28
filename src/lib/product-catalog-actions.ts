"use server";

import { db } from "@/db";
import {
  categories,
  products,
  productVariants,
  productOptionValues,
  orderItems,
  users,
} from "@/db/schema";
import type {
  Category,
  Product,
  ProductVariant,
  ProductOptionValue,
  NewCategory,
  NewProduct,
  NewProductVariant,
} from "@/db/schema";
import { eq, asc, desc, and, isNull, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié");
  const [dbUser] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (dbUser?.role !== "admin") throw new Error("Non autorisé");
  return session;
}

// ─── Result type ──────────────────────────────────────────────────────────────

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ─── Categories ───────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "Nom requis"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug invalide (minuscules, chiffres, tirets)"),
  description: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export async function getCategories(): Promise<Category[]> {
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return rows[0];
}

export async function createCategory(
  input: z.input<typeof categorySchema>,
): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin();
    const data = categorySchema.parse(input);
    const [row] = await db
      .insert(categories)
      .values(data as NewCategory)
      .returning({ id: categories.id });
    revalidatePath("/admin/categories");
    revalidatePath("/products");
    return { ok: true, data: { id: row!.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function updateCategory(
  id: string,
  input: z.input<typeof categorySchema>,
): Promise<Result> {
  try {
    await requireAdmin();
    const data = categorySchema.parse(input);
    await db.update(categories).set({ ...data, updatedAt: new Date() }).where(eq(categories.id, id));
    revalidatePath("/admin/categories");
    revalidatePath("/admin/categories/" + id);
    revalidatePath("/products");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function deleteCategory(id: string): Promise<Result> {
  try {
    await requireAdmin();
    await db.delete(categories).where(eq(categories.id, id));
    revalidatePath("/admin/categories");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────

const productInfoSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug invalide"),
  description: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
  features: z.array(z.string()).default([]),
  imageUrl: z.string().optional().nullable(),
  images: z.array(z.string()).default([]),
  categoryId: z.string().uuid().optional().nullable(),
  requiresCustomization: z.boolean().default(true),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export type ProductInfoInput = z.input<typeof productInfoSchema>;

const newProductSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  categoryId: z.string().uuid().optional().nullable(),
  requiresCustomization: z.boolean().default(true),
  // Initial variant defaults
  material: z.string().default("vinyl"),
  basePriceCents: z.number().int().default(599),
});

export type NewProductInput = z.input<typeof newProductSchema>;

export async function getProductWithVariants(
  id: string,
): Promise<(Product & { variants: ProductVariant[] }) | undefined> {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  const product = rows[0];
  if (!product) return undefined;

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id))
    .orderBy(asc(productVariants.sortOrder), asc(productVariants.createdAt));

  return { ...product, variants };
}

export async function getAdminProducts(): Promise<
  (Product & { variants: ProductVariant[]; category: Category | null })[]
> {
  const prods = await db
    .select()
    .from(products)
    .where(isNull(products.deletedAt))
    .orderBy(asc(products.sortOrder), desc(products.createdAt));

  if (!prods.length) return [];

  const productIds = prods.map((p) => p.id);
  const allVariants = productIds.length
    ? await db
        .select()
        .from(productVariants)
        .where(inArray(productVariants.productId, productIds))
        .orderBy(asc(productVariants.sortOrder))
    : [];

  const allCatIds = [...new Set(prods.map((p) => p.categoryId).filter(Boolean))] as string[];
  const allCats = allCatIds.length
    ? await db.select().from(categories).where(inArray(categories.id, allCatIds))
    : [];
  const catMap = new Map(allCats.map((c) => [c.id, c]));

  return prods.map((p) => ({
    ...p,
    variants: allVariants.filter((v) => v.productId === p.id),
    category: p.categoryId ? (catMap.get(p.categoryId) ?? null) : null,
  }));
}

export async function createProduct(input: NewProductInput): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin();
    const data = newProductSchema.parse(input);

    const slug = data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90);

    const [product] = await db
      .insert(products)
      .values({
        name: data.name,
        slug,
        categoryId: data.categoryId ?? null,
        requiresCustomization: data.requiresCustomization,
        // Legacy required fields with sensible defaults
        basePriceCents: data.basePriceCents,
        material: data.material,
        images: [],
        features: [],
      } as NewProduct)
      .returning({ id: products.id });

    // Create a default variant
    await db.insert(productVariants).values({
      productId: product!.id,
      name: `Variant ${data.material}`,
      sku: `MSA-${data.material.toUpperCase()}-${product!.id.slice(0, 6).toUpperCase()}`,
      material: data.material,
      basePriceCents: data.basePriceCents,
      availableFinishes: ["gloss"],
      shapes: ["die-cut", "circle", "square"],
      minQty: 1,
      weightGrams: 100,
      minWidthMm: 20,
      maxWidthMm: 300,
      minHeightMm: 20,
      maxHeightMm: 300,
      images: [],
    } as NewProductVariant);

    revalidatePath("/admin/products");
    return { ok: true, data: { id: product!.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function updateProductInfo(
  id: string,
  input: ProductInfoInput,
): Promise<Result> {
  try {
    await requireAdmin();
    const data = productInfoSchema.parse(input);

    // Also update legacy fields to keep them in sync for front-end compat
    await db.update(products).set({
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      tagline: data.tagline ?? null,
      features: data.features,
      imageUrl: data.imageUrl ?? null,
      images: data.images,
      categoryId: data.categoryId ?? null,
      requiresCustomization: data.requiresCustomization,
      active: data.active,
      sortOrder: data.sortOrder,
      updatedAt: new Date(),
    }).where(eq(products.id, id));

    revalidatePath("/admin/products");
    revalidatePath("/admin/products/" + id);
    revalidatePath("/products");
    revalidatePath("/products/" + data.slug);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function deleteProduct(id: string): Promise<Result> {
  try {
    await requireAdmin();
    await db.update(products).set({ deletedAt: new Date(), active: false }).where(eq(products.id, id));
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function duplicateProduct(id: string): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin();
    const source = await getProductWithVariants(id);
    if (!source) return { ok: false, error: "Produit introuvable" };

    const newSlug = `${source.slug}-copy-${Date.now()}`;
    const [newProduct] = await db
      .insert(products)
      .values({
        ...source,
        id: undefined as unknown as string, // let DB generate
        slug: newSlug,
        name: `${source.name} (copie)`,
        active: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as NewProduct)
      .returning({ id: products.id });

    for (const variant of source.variants) {
      const newSku = variant.sku ? `${variant.sku}-COPY` : undefined;
      await db.insert(productVariants).values({
        ...variant,
        id: undefined as unknown as string,
        productId: newProduct!.id,
        sku: newSku ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as NewProductVariant);
    }

    revalidatePath("/admin/products");
    return { ok: true, data: { id: newProduct!.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ─── Variants ─────────────────────────────────────────────────────────────────

const variantSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().min(1, "Nom requis"),
  sku: z.string().optional().nullable(),
  material: z.string().min(1, "Matière requise"),
  availableFinishes: z.array(z.string()).default(["gloss"]),
  shapes: z.array(z.string()).default(["die-cut", "circle", "square"]),
  basePriceCents: z.number().int().min(1, "Prix requis"),
  minQty: z.number().int().min(1).default(1),
  weightGrams: z.number().int().min(1).default(100),
  minWidthMm: z.number().int().default(20),
  maxWidthMm: z.number().int().default(300),
  minHeightMm: z.number().int().default(20),
  maxHeightMm: z.number().int().default(300),
  tiers: z.array(z.object({ minQty: z.number(), discountPct: z.number() })).optional().nullable(),
  sizePrices: z.record(z.string(), z.number()).optional().nullable(),
  customPresets: z
    .array(z.object({ id: z.string(), label: z.string(), widthMm: z.number(), heightMm: z.number() }))
    .optional()
    .nullable(),
  imageUrl: z.string().optional().nullable(),
  images: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export type VariantInput = z.input<typeof variantSchema>;

export async function createVariant(input: VariantInput): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin();
    const data = variantSchema.parse(input);
    const [row] = await db
      .insert(productVariants)
      .values(data as NewProductVariant)
      .returning({ id: productVariants.id });

    // Sync product's legacy material/price fields from first variant
    const siblings = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, data.productId))
      .orderBy(asc(productVariants.sortOrder))
      .limit(1);
    if (siblings.length === 0) {
      await syncProductLegacyFields(data.productId, data as unknown as ProductVariant);
    }

    revalidatePath("/admin/products/" + data.productId);
    return { ok: true, data: { id: row!.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function updateVariant(id: string, input: VariantInput): Promise<Result> {
  try {
    await requireAdmin();
    const data = variantSchema.parse(input);
    await db
      .update(productVariants)
      .set({ ...data, sizePrices: (data.sizePrices ?? null) as Record<string, number> | null, updatedAt: new Date() })
      .where(eq(productVariants.id, id));

    // Sync legacy product fields from the first (lowest sortOrder) variant
    const firstVariant = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, data.productId))
      .orderBy(asc(productVariants.sortOrder))
      .limit(1);
    if (firstVariant[0]) {
      await syncProductLegacyFields(data.productId, firstVariant[0]);
    }

    revalidatePath("/admin/products/" + data.productId);
    revalidatePath("/products");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function deleteVariant(id: string): Promise<Result> {
  try {
    await requireAdmin();
    const [variant] = await db
      .select({ productId: productVariants.productId })
      .from(productVariants)
      .where(eq(productVariants.id, id))
      .limit(1);
    await db.delete(productVariants).where(eq(productVariants.id, id));
    if (variant) revalidatePath("/admin/products/" + variant.productId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

export async function reorderVariants(productId: string, orderedIds: string[]): Promise<Result> {
  try {
    await requireAdmin();
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(productVariants)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(
          and(eq(productVariants.id, orderedIds[i]!), eq(productVariants.productId, productId)),
        );
    }
    revalidatePath("/admin/products/" + productId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ─── Migration ────────────────────────────────────────────────────────────────

export async function migrateProductsToVariants(): Promise<
  Result<{ migrated: number; skipped: number }>
> {
  try {
    await requireAdmin();

    const allProducts = await db.select().from(products).where(isNull(products.deletedAt));
    let migrated = 0;
    let skipped = 0;

    for (const p of allProducts) {
      // Check if already has variants
      const existing = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.productId, p.id))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const opts = (p.options ?? {}) as Record<string, unknown>;
      const tiers = Array.isArray(opts.tiers) ? opts.tiers : null;
      const sizePrices =
        opts.sizePrices && typeof opts.sizePrices === "object" && !Array.isArray(opts.sizePrices)
          ? (opts.sizePrices as Record<string, number>)
          : null;
      const customPresets = Array.isArray(opts.customPresets) ? opts.customPresets : null;
      const availableFinishes = Array.isArray(opts.availableFinishes)
        ? (opts.availableFinishes as string[])
        : ["gloss"];

      await db.insert(productVariants).values({
        productId: p.id,
        name: p.name,
        sku: `MSA-${p.material.toUpperCase()}-MIG`,
        material: p.material,
        availableFinishes,
        shapes: p.shapes,
        basePriceCents: p.basePriceCents,
        minQty: p.minQty,
        weightGrams: 100,
        minWidthMm: p.minWidthMm,
        maxWidthMm: p.maxWidthMm,
        minHeightMm: p.minHeightMm,
        maxHeightMm: p.maxHeightMm,
        tiers: tiers as never,
        sizePrices: sizePrices as never,
        customPresets: customPresets as never,
        imageUrl: p.imageUrl,
        images: [],
        active: true,
        sortOrder: 0,
      } as NewProductVariant);

      // Also set the tagline/features from options on the product
      const tagline = typeof opts.tagline === "string" ? opts.tagline : null;
      const features = Array.isArray(opts.features) ? (opts.features as string[]) : [];
      await db.update(products).set({ tagline, features, updatedAt: new Date() }).where(eq(products.id, p.id));

      migrated++;
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { ok: true, data: { migrated, skipped } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Keep legacy product fields in sync with the first variant (for front-end compat) */
async function syncProductLegacyFields(productId: string, variant: ProductVariant) {
  await db.update(products).set({
    basePriceCents: variant.basePriceCents,
    material: variant.material,
    minWidthMm: variant.minWidthMm,
    maxWidthMm: variant.maxWidthMm,
    minHeightMm: variant.minHeightMm,
    maxHeightMm: variant.maxHeightMm,
    shapes: variant.shapes,
    minQty: variant.minQty,
    options: {
      tiers: variant.tiers ?? [],
      sizePrices: variant.sizePrices ?? {},
      customPresets: variant.customPresets ?? [],
      availableFinishes: variant.availableFinishes,
    },
    updatedAt: new Date(),
  }).where(eq(products.id, productId));
}

// ─── Order item helpers (check requiresCustomization) ─────────────────────────

export async function orderRequiresCustomization(orderId: string): Promise<boolean> {
  const items = await db
    .select({ productId: orderItems.productId, variantId: orderItems.variantId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (!items.length) return true;

  // Get all product IDs from order items
  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))] as string[];
  if (!productIds.length) return true;

  const prods = await db
    .select({ id: products.id, requiresCustomization: products.requiresCustomization })
    .from(products)
    .where(inArray(products.id, productIds));

  return prods.some((p) => p.requiresCustomization);
}

// ─── Product option values (shapes / finishes / materials) ────────────────────

export async function getOptionValues(type: string): Promise<ProductOptionValue[]> {
  return db
    .select()
    .from(productOptionValues)
    .where(eq(productOptionValues.type, type))
    .orderBy(asc(productOptionValues.sortOrder), asc(productOptionValues.label));
}

export async function getActiveOptionValues(type: string): Promise<ProductOptionValue[]> {
  return db
    .select()
    .from(productOptionValues)
    .where(and(eq(productOptionValues.type, type), eq(productOptionValues.active, true)))
    .orderBy(asc(productOptionValues.sortOrder), asc(productOptionValues.label));
}

const optionValueSchema = z.object({
  type: z.enum(["shape", "finish", "material"]),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug : lettres minuscules, chiffres et tirets"),
  label: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function createOptionValue(
  data: z.infer<typeof optionValueSchema>,
): Promise<Result<ProductOptionValue>> {
  await requireAdmin();
  const parsed = optionValueSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };

  const existing = await db
    .select({ id: productOptionValues.id })
    .from(productOptionValues)
    .where(and(eq(productOptionValues.type, parsed.data.type), eq(productOptionValues.slug, parsed.data.slug)))
    .limit(1);
  if (existing.length) return { ok: false, error: "Un slug identique existe déjà pour ce type." };

  const [row] = await db
    .insert(productOptionValues)
    .values({ ...parsed.data, description: parsed.data.description ?? null })
    .returning();
  if (!row) return { ok: false, error: "Erreur lors de la création." };
  return { ok: true, data: row };
}

export async function updateOptionValue(
  id: string,
  data: Partial<z.infer<typeof optionValueSchema>>,
): Promise<Result<ProductOptionValue>> {
  await requireAdmin();

  const [row] = await db
    .update(productOptionValues)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(productOptionValues.id, id))
    .returning();
  if (!row) return { ok: false, error: "Option introuvable." };
  return { ok: true, data: row };
}

export async function deleteOptionValue(id: string): Promise<Result<void>> {
  await requireAdmin();

  await db.delete(productOptionValues).where(eq(productOptionValues.id, id));
  return { ok: true, data: undefined };
}

// ─── Seeder: insert default option values if table is empty ───────────────────

export async function seedOptionValues(): Promise<Result<{ inserted: number }>> {
  await requireAdmin();

  const existing = await db.select({ count: sql<number>`count(*)` }).from(productOptionValues);
  if (Number(existing[0]?.count ?? 0) > 0) {
    return { ok: true, data: { inserted: 0 } };
  }

  const defaults: Array<{ type: string; slug: string; label: string; sortOrder: number }> = [
    { type: "shape", slug: "die-cut", label: "Die-cut", sortOrder: 0 },
    { type: "shape", slug: "circle", label: "Cercle", sortOrder: 1 },
    { type: "shape", slug: "square", label: "Carré", sortOrder: 2 },
    { type: "shape", slug: "rectangle", label: "Rectangle", sortOrder: 3 },
    { type: "shape", slug: "kiss-cut", label: "Kiss-cut", sortOrder: 4 },
    { type: "finish", slug: "gloss", label: "Brillant", sortOrder: 0 },
    { type: "finish", slug: "matte", label: "Mat", sortOrder: 1 },
    { type: "finish", slug: "uv-laminated", label: "UV laminé", sortOrder: 2 },
    { type: "material", slug: "vinyl", label: "Vinyle", sortOrder: 0 },
    { type: "material", slug: "holographic", label: "Holographique", sortOrder: 1 },
    { type: "material", slug: "glitter", label: "Pailleté", sortOrder: 2 },
    { type: "material", slug: "transparent", label: "Transparent", sortOrder: 3 },
    { type: "material", slug: "kraft", label: "Kraft", sortOrder: 4 },
  ];

  await db.insert(productOptionValues).values(defaults);
  return { ok: true, data: { inserted: defaults.length } };
}
