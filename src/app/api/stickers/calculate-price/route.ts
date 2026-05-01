import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStickerCatalogForProduct } from "@/lib/sticker-catalog-actions";
import { computeStickerPrice } from "@/lib/sticker-pricing";

const schema = z.object({
  productId: z.string().uuid(),
  shapeId: z.string().uuid(),
  widthMm: z.number().int().min(1).max(5000),
  heightMm: z.number().int().min(1).max(5000),
  quantity: z.number().int().min(1),
  materialId: z.string().uuid(),
  laminationId: z.string().uuid().optional().nullable(),
  cutTypeId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = schema.parse(body);

    const catalog = await getStickerCatalogForProduct(input.productId);
    if (!catalog) {
      return NextResponse.json({ error: "Produit non trouvé ou non configuré" }, { status: 404 });
    }

    const { config, shapes, materials, laminations, cutTypes } = catalog;

    const shape = shapes.find((s) => s.id === input.shapeId);
    const material = materials.find((m) => m.id === input.materialId);
    const lamination = input.laminationId ? laminations.find((l) => l.id === input.laminationId) : null;
    const cutType = cutTypes.find((c) => c.id === input.cutTypeId);

    if (!shape) return NextResponse.json({ error: "Forme invalide" }, { status: 400 });
    if (!material) return NextResponse.json({ error: "Matière invalide" }, { status: 400 });
    if (!cutType) return NextResponse.json({ error: "Type de découpe invalide" }, { status: 400 });

    const result = computeStickerPrice({
      widthMm: input.widthMm,
      heightMm: input.heightMm,
      quantity: input.quantity,
      pricePerCm2Cents: config.pricePerCm2Cents,
      quantityTiers: config.quantityTiers,
      setupFeeCents: config.setupFeeCents,
      minOrderCents: config.minOrderCents,
      shapeModifier: {
        type: shape.priceModifierType as "none" | "fixed" | "percentage" | "multiplier",
        value: shape.priceModifierValue,
      },
      materialModifier: {
        type: material.priceModifierType as "none" | "fixed" | "percentage" | "multiplier",
        value: material.priceModifierValue,
      },
      laminationModifier: lamination
        ? {
            type: lamination.priceModifierType as "none" | "fixed" | "percentage" | "multiplier",
            value: lamination.priceModifierValue,
          }
        : null,
      cutTypeModifier: {
        type: cutType.priceModifierType as "none" | "fixed" | "percentage" | "multiplier",
        value: cutType.priceModifierValue,
      },
    });

    return NextResponse.json({
      ok: true,
      ...result,
      shape: { id: shape.id, name: shape.name, code: shape.code },
      material: { id: material.id, name: material.name },
      lamination: lamination ? { id: lamination.id, name: lamination.name } : null,
      cutType: { id: cutType.id, name: cutType.name },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Paramètres invalides", details: err.issues }, { status: 400 });
    }
    console.error("[calculate-price]", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
