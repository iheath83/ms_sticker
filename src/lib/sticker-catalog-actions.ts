"use server";

import { db } from "@/db";
import {
  stickerShapes,
  stickerSizes,
  stickerMaterials,
  stickerLaminations,
  productStickerConfigs,
  type StickerShape,
  type StickerSize,
  type StickerMaterial,
  type StickerLamination,
  type ProductStickerConfig,
  type StickerQuantityTier,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Read helpers (public — no auth needed) ──────────────────────────────────

export async function getAllStickerShapes(): Promise<StickerShape[]> {
  return db.select().from(stickerShapes).orderBy(asc(stickerShapes.position), asc(stickerShapes.name));
}

export async function getActiveStickerShapes(): Promise<StickerShape[]> {
  return db
    .select()
    .from(stickerShapes)
    .where(eq(stickerShapes.isActive, true))
    .orderBy(asc(stickerShapes.position), asc(stickerShapes.name));
}

export async function getAllStickerSizes(): Promise<StickerSize[]> {
  return db.select().from(stickerSizes).orderBy(asc(stickerSizes.position), asc(stickerSizes.widthMm));
}

export async function getActiveStickerSizes(): Promise<StickerSize[]> {
  return db
    .select()
    .from(stickerSizes)
    .where(eq(stickerSizes.isActive, true))
    .orderBy(asc(stickerSizes.position), asc(stickerSizes.widthMm));
}

export async function getAllStickerMaterials(): Promise<StickerMaterial[]> {
  return db.select().from(stickerMaterials).orderBy(asc(stickerMaterials.position), asc(stickerMaterials.name));
}

export async function getActiveStickerMaterials(): Promise<StickerMaterial[]> {
  return db
    .select()
    .from(stickerMaterials)
    .where(eq(stickerMaterials.isActive, true))
    .orderBy(asc(stickerMaterials.position), asc(stickerMaterials.name));
}

export async function getAllStickerLaminations(): Promise<StickerLamination[]> {
  return db.select().from(stickerLaminations).orderBy(asc(stickerLaminations.position), asc(stickerLaminations.name));
}

export async function getActiveStickerLaminations(): Promise<StickerLamination[]> {
  return db
    .select()
    .from(stickerLaminations)
    .where(eq(stickerLaminations.isActive, true))
    .orderBy(asc(stickerLaminations.position), asc(stickerLaminations.name));
}

export async function getProductStickerConfig(productId: string): Promise<ProductStickerConfig | null> {
  const rows = await db
    .select()
    .from(productStickerConfigs)
    .where(eq(productStickerConfigs.productId, productId))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Shape CRUD ──────────────────────────────────────────────────────────────

const shapeSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z_]+$/),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  isStandardShape: z.boolean().default(true),
  requiresCutPath: z.boolean().default(false),
  priceModifierType: z.enum(["none", "fixed", "percentage", "multiplier"]).default("none"),
  priceModifierValue: z.number().min(0).default(1),
  iconSvg: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  position: z.number().int().default(0),
});

export async function createStickerShape(data: z.infer<typeof shapeSchema>) {
  const parsed = shapeSchema.parse(data);
  const [row] = await db.insert(stickerShapes).values(parsed).returning();
  revalidatePath("/admin/sticker");
  return row;
}

export async function updateStickerShape(id: string, data: Partial<z.infer<typeof shapeSchema>>) {
  const parsed = shapeSchema.partial().parse(data);
  const [row] = await db.update(stickerShapes).set({ ...parsed, updatedAt: new Date() }).where(eq(stickerShapes.id, id)).returning();
  revalidatePath("/admin/sticker");
  return row;
}

export async function deleteStickerShape(id: string) {
  await db.delete(stickerShapes).where(eq(stickerShapes.id, id));
  revalidatePath("/admin/sticker");
}

// ─── Size CRUD ───────────────────────────────────────────────────────────────

const sizeSchema = z.object({
  label: z.string().min(1).max(100),
  widthMm: z.number().int().min(1).max(5000),
  heightMm: z.number().int().min(1).max(5000),
  isPreset: z.boolean().default(true),
  isActive: z.boolean().default(true),
  minQuantity: z.number().int().optional().nullable(),
  priceCents: z.number().int().min(0).optional().nullable(),
  position: z.number().int().default(0),
});

export async function createStickerSize(data: z.infer<typeof sizeSchema>) {
  const parsed = sizeSchema.parse(data);
  const [row] = await db.insert(stickerSizes).values(parsed).returning();
  revalidatePath("/admin/sticker");
  return row;
}

export async function updateStickerSize(id: string, data: Partial<z.infer<typeof sizeSchema>>) {
  const parsed = sizeSchema.partial().parse(data);
  const [row] = await db.update(stickerSizes).set({ ...parsed, updatedAt: new Date() }).where(eq(stickerSizes.id, id)).returning();
  revalidatePath("/admin/sticker");
  return row;
}

export async function deleteStickerSize(id: string) {
  await db.delete(stickerSizes).where(eq(stickerSizes.id, id));
  revalidatePath("/admin/sticker");
}

// ─── Material CRUD ───────────────────────────────────────────────────────────

const materialSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z_]+$/),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  isWaterproof: z.boolean().default(true),
  isOutdoorCompatible: z.boolean().default(false),
  isTransparent: z.boolean().default(false),
  isPremium: z.boolean().default(false),
  priceModifierType: z.enum(["none", "fixed", "percentage", "multiplier"]).default("multiplier"),
  priceModifierValue: z.number().min(0).default(1),
  compatibleLaminationCodes: z.array(z.string()).default([]),
  previewImageUrl: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  position: z.number().int().default(0),
});

export async function createStickerMaterial(data: z.infer<typeof materialSchema>) {
  const parsed = materialSchema.parse(data);
  const [row] = await db.insert(stickerMaterials).values(parsed).returning();
  revalidatePath("/admin/sticker");
  return row;
}

export async function updateStickerMaterial(id: string, data: Partial<z.infer<typeof materialSchema>>) {
  const parsed = materialSchema.partial().parse(data);
  const [row] = await db.update(stickerMaterials).set({ ...parsed, updatedAt: new Date() }).where(eq(stickerMaterials.id, id)).returning();
  revalidatePath("/admin/sticker");
  return row;
}

export async function deleteStickerMaterial(id: string) {
  await db.delete(stickerMaterials).where(eq(stickerMaterials.id, id));
  revalidatePath("/admin/sticker");
}

// ─── Lamination CRUD ─────────────────────────────────────────────────────────

const laminationSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z_]+$/),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  priceModifierType: z.enum(["none", "fixed", "percentage", "multiplier"]).default("multiplier"),
  priceModifierValue: z.number().min(0).default(1),
  compatibleMaterialCodes: z.array(z.string()).default([]),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  position: z.number().int().default(0),
});

export async function createStickerLamination(data: z.infer<typeof laminationSchema>) {
  const parsed = laminationSchema.parse(data);
  const [row] = await db.insert(stickerLaminations).values(parsed).returning();
  revalidatePath("/admin/sticker");
  return row;
}

export async function updateStickerLamination(id: string, data: Partial<z.infer<typeof laminationSchema>>) {
  const parsed = laminationSchema.partial().parse(data);
  const [row] = await db.update(stickerLaminations).set({ ...parsed, updatedAt: new Date() }).where(eq(stickerLaminations.id, id)).returning();
  revalidatePath("/admin/sticker");
  return row;
}

export async function deleteStickerLamination(id: string) {
  await db.delete(stickerLaminations).where(eq(stickerLaminations.id, id));
  revalidatePath("/admin/sticker");
}

// ─── Product Sticker Config CRUD ─────────────────────────────────────────────

const stickerConfigSchema = z.object({
  enabledShapeIds: z.array(z.string().uuid()).default([]),
  shapeModifierOverrides: z.record(z.string().uuid(), z.number().min(0)).default({}),
  enabledSizeIds: z.array(z.string().uuid()).default([]),
  sizePriceOverrides: z.record(z.string().uuid(), z.number().int().min(0)).default({}),
  enabledMaterialIds: z.array(z.string().uuid()).default([]),
  materialModifierOverrides: z.record(z.string().uuid(), z.number().min(0)).default({}),
  enabledLaminationIds: z.array(z.string().uuid()).default([]),
  laminationModifierOverrides: z.record(z.string().uuid(), z.number().min(0)).default({}),
  allowCustomWidth: z.boolean().default(false),
  allowCustomHeight: z.boolean().default(false),
  minWidthMm: z.number().int().min(1).default(20),
  maxWidthMm: z.number().int().min(1).default(1000),
  minHeightMm: z.number().int().min(1).default(20),
  maxHeightMm: z.number().int().min(1).default(1000),
  requireFileUpload: z.boolean().default(true),
  allowedFileExtensions: z.array(z.string()).default(["pdf", "ai", "eps", "svg", "png", "jpg", "jpeg"]),
  maxFileSizeMb: z.number().int().min(1).default(100),
  defaultShapeId: z.string().uuid().optional().nullable(),
  defaultMaterialId: z.string().uuid().optional().nullable(),
  defaultLaminationId: z.string().uuid().optional().nullable(),
  pricingMode: z.enum(["per_cm2", "unit_price"]).default("per_cm2"),
  pricePerCm2Cents: z.number().int().min(0).default(150),
  baseUnitPriceCents: z.number().int().min(0).default(0),
  quantityTiers: z.array(z.object({ minQty: z.number().int(), discountPct: z.number() })).default([]),
  setupFeeCents: z.number().int().min(0).default(0),
  minOrderCents: z.number().int().min(0).default(0),
});

export async function upsertProductStickerConfig(
  productId: string,
  data: z.infer<typeof stickerConfigSchema>,
) {
  const parsed = stickerConfigSchema.parse(data);
  const existing = await getProductStickerConfig(productId);

  if (existing) {
    const [row] = await db
      .update(productStickerConfigs)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(productStickerConfigs.productId, productId))
      .returning();
    revalidatePath(`/admin/products/${productId}`);
    return row;
  } else {
    const [row] = await db
      .insert(productStickerConfigs)
      .values({ productId, ...parsed })
      .returning();
    revalidatePath(`/admin/products/${productId}`);
    return row;
  }
}

// ─── Full catalog for frontend ────────────────────────────────────────────────

export interface StickerCatalogForProduct {
  config: ProductStickerConfig;
  shapes: StickerShape[];
  sizes: StickerSize[];
  materials: StickerMaterial[];
  laminations: StickerLamination[];
}

export async function getStickerCatalogForProduct(productId: string): Promise<StickerCatalogForProduct | null> {
  const config = await getProductStickerConfig(productId);
  if (!config) return null;

  const [allShapes, allSizes, allMaterials, allLaminations] = await Promise.all([
    getActiveStickerShapes(),
    getActiveStickerSizes(),
    getActiveStickerMaterials(),
    getActiveStickerLaminations(),
  ]);

  const shapes = allShapes.filter((s) => config.enabledShapeIds.includes(s.id));
  const sizes = allSizes.filter((s) => config.enabledSizeIds.includes(s.id));
  const materials = allMaterials.filter((m) => config.enabledMaterialIds.includes(m.id));
  const laminations = allLaminations.filter((l) => config.enabledLaminationIds.includes(l.id));

  return { config, shapes, sizes, materials, laminations };
}
