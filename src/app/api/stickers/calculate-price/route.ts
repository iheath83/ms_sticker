import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStickerCatalogForProduct } from "@/lib/sticker-catalog-actions";
import { computeStickerPrice } from "@/lib/sticker-pricing";
import type { StickerPriceModifierType } from "@/db/schema";

const NONE_MODIFIER = { type: "none" as StickerPriceModifierType, value: 1 };

const schema = z.object({
  productId:    z.string().uuid(),
  shapeId:      z.string().uuid().optional().nullable(),
  widthMm:      z.number().int().min(1).max(5000),
  heightMm:     z.number().int().min(1).max(5000),
  quantity:     z.number().int().min(1),
  materialId:   z.string().uuid().optional().nullable(),
  laminationId: z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = schema.parse(body);

    const catalog = await getStickerCatalogForProduct(input.productId);
    if (!catalog) {
      return NextResponse.json({ error: "Produit non trouvé ou non configuré" }, { status: 404 });
    }

    const { config, shapes, materials, laminations } = catalog;

    const shape     = input.shapeId     ? shapes.find((s) => s.id === input.shapeId)         : null;
    const material  = input.materialId  ? materials.find((m) => m.id === input.materialId)   : null;
    const lamination = input.laminationId ? laminations.find((l) => l.id === input.laminationId) : null;

    // Validate only if step is present in the catalog
    if (input.shapeId && shapes.length > 0 && !shape) {
      return NextResponse.json({ error: "Forme invalide" }, { status: 400 });
    }
    if (input.materialId && materials.length > 0 && !material) {
      return NextResponse.json({ error: "Matière invalide" }, { status: 400 });
    }

    const pricingMode = (config.pricingMode ?? "per_cm2") as "per_cm2" | "unit_price";

    const result = computeStickerPrice({
      pricingMode,
      widthMm:          input.widthMm,
      heightMm:         input.heightMm,
      quantity:         input.quantity,
      pricePerCm2Cents: config.pricePerCm2Cents,
      baseUnitPriceCents: config.baseUnitPriceCents ?? 0,
      quantityTiers:    config.quantityTiers,
      setupFeeCents:    config.setupFeeCents,
      minOrderCents:    config.minOrderCents,
      shapeModifier: shape
        ? { type: shape.priceModifierType as StickerPriceModifierType, value: shape.priceModifierValue }
        : NONE_MODIFIER,
      materialModifier: material
        ? { type: material.priceModifierType as StickerPriceModifierType, value: material.priceModifierValue }
        : NONE_MODIFIER,
      laminationModifier: lamination
        ? { type: lamination.priceModifierType as StickerPriceModifierType, value: lamination.priceModifierValue }
        : null,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      ...(shape     ? { shape:     { id: shape.id,     name: shape.name,     code: shape.code } } : {}),
      ...(material  ? { material:  { id: material.id,  name: material.name  } } : {}),
      ...(lamination ? { lamination: { id: lamination.id, name: lamination.name } } : { lamination: null }),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Paramètres invalides", details: err.issues }, { status: 400 });
    }
    console.error("[calculate-price]", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
