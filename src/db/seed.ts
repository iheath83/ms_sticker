/**
 * Seed script — run with: npx tsx src/db/seed.ts
 * Inserts 5 products + shipping rates if they don't already exist.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { products, shippingRates } from "./schema";
import { eq } from "drizzle-orm";

async function main() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  console.log("🌱 Seeding products...");

  const seedProducts = [
    {
      slug: "stickers-vinyle-decoupe",
      name: "Stickers Vinyle Découpé",
      description: `## Stickers Vinyle Découpé

Le classique indémodable. Découpés précisément selon la forme de votre design, ces stickers en vinyle blanc mat adhèrent sur toutes les surfaces lisses.

**Idéal pour :** logos, illustrations, packaging, déco murale, vélos, casques.

- Vinyle blanc mat haute qualité
- Résistant à l'eau et aux UV
- Colle repositionnable ou permanente au choix
- Fond transparent ou blanc`,
      basePriceCents: 2490,
      material: "vinyl",
      minWidthMm: 20,
      maxWidthMm: 300,
      minHeightMm: 20,
      maxHeightMm: 300,
      shapes: ["die-cut", "circle", "square", "rectangle"],
      options: {
        finishes: ["gloss", "matte"],
        uvLaminated: true,
        whiteInk: false,
      },
      active: true,
      sortOrder: 1,
    },
    {
      slug: "stickers-holographiques",
      name: "Stickers Holographiques",
      description: `## Stickers Holographiques

Un effet wow garanti. Les stickers holographiques réfléchissent la lumière pour créer un effet arc-en-ciel irisé qui attire tous les regards.

**Idéal pour :** éditions limitées, produits premium, packaging luxe, cadeaux.

- Film holographique prismatique
- Finition ultra-brillante
- Résistant à l'eau et aux rayures
- Effet unique selon l'angle d'éclairage`,
      basePriceCents: 3990,
      material: "holographic",
      minWidthMm: 20,
      maxWidthMm: 200,
      minHeightMm: 20,
      maxHeightMm: 200,
      shapes: ["die-cut", "circle", "square"],
      options: {
        finishes: ["holographic"],
        uvLaminated: true,
        whiteInk: true,
      },
      active: true,
      sortOrder: 2,
    },
    {
      slug: "stickers-transparents",
      name: "Stickers Transparents",
      description: `## Stickers Transparents

L'illusion parfaite du dessin directement sur la surface. Le fond est invisible, seul votre design ressort.

**Idéal pour :** vitres, bouteilles, emballages, produits alimentaires (version food-safe).

- Film polyester transparent
- Finition gloss ou mat
- Résistant à l'humidité
- Effet "no-label" sur supports clairs`,
      basePriceCents: 2990,
      material: "transparent",
      minWidthMm: 20,
      maxWidthMm: 250,
      minHeightMm: 20,
      maxHeightMm: 250,
      shapes: ["die-cut", "circle", "square", "rectangle"],
      options: {
        finishes: ["gloss", "matte"],
        uvLaminated: false,
        whiteInk: true,
      },
      active: true,
      sortOrder: 3,
    },
    {
      slug: "stickers-pailletes",
      name: "Stickers Pailletés",
      description: `## Stickers Pailletés

Du glamour et de l'éclat à tous vos projets. Ces stickers intègrent de vraies paillettes pour un rendu festif et brillant incomparable.

**Idéal pour :** événements, fêtes, produits beauté, cadeaux, éditions spéciales.

- Film vinyle avec paillettes intégrées
- Disponible en or, argent, rose gold
- Résistant à l'eau
- Découpe forme libre`,
      basePriceCents: 4490,
      material: "glitter",
      minWidthMm: 30,
      maxWidthMm: 150,
      minHeightMm: 30,
      maxHeightMm: 150,
      shapes: ["die-cut", "circle", "square"],
      options: {
        finishes: ["glitter-gold", "glitter-silver", "glitter-rose-gold"],
        uvLaminated: false,
        whiteInk: false,
      },
      active: true,
      sortOrder: 4,
    },
    {
      slug: "stickers-papier-kraft",
      name: "Étiquettes Papier Kraft",
      description: `## Étiquettes Papier Kraft

Le choix éco-responsable. Ces étiquettes en papier kraft naturel apportent une touche artisanale et authentique à vos produits.

**Idéal pour :** épicerie fine, cosmétique naturelle, vins & spiritueux, cadeaux faits-main.

- Papier kraft FSC 120g
- Impression offset quadrichromie
- Compatible imprimantes thermiques (fond blanc)
- Recyclable et biodégradable`,
      basePriceCents: 1990,
      material: "kraft",
      minWidthMm: 30,
      maxWidthMm: 200,
      minHeightMm: 30,
      maxHeightMm: 200,
      shapes: ["rectangle", "circle", "square"],
      options: {
        finishes: ["natural-matte"],
        uvLaminated: false,
        whiteInk: false,
      },
      active: true,
      sortOrder: 5,
    },
  ] as const;

  for (const product of seedProducts) {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, product.slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⏭  ${product.name} — already exists, skipping`);
      continue;
    }

    await db.insert(products).values({ ...product, shapes: product.shapes as unknown as string[] });
    console.log(`  ✓  ${product.name} — inserted`);
  }

  console.log("\n🌱 Seeding shipping rates...");

  const seedShippingRates = [
    // France
    { countryCode: "FR", method: "standard", priceCents: 490, etaDaysMin: 2, etaDaysMax: 4, freeAboveCents: 5000, active: true },
    { countryCode: "FR", method: "express", priceCents: 990, etaDaysMin: 1, etaDaysMax: 2, freeAboveCents: null, active: true },
    // Europe (zone 1 — BE, LU, NL, DE)
    { countryCode: "BE", method: "standard", priceCents: 790, etaDaysMin: 3, etaDaysMax: 5, freeAboveCents: 8000, active: true },
    { countryCode: "LU", method: "standard", priceCents: 790, etaDaysMin: 3, etaDaysMax: 5, freeAboveCents: 8000, active: true },
    { countryCode: "NL", method: "standard", priceCents: 890, etaDaysMin: 3, etaDaysMax: 6, freeAboveCents: 8000, active: true },
    { countryCode: "DE", method: "standard", priceCents: 890, etaDaysMin: 3, etaDaysMax: 6, freeAboveCents: 8000, active: true },
    // Europe (zone 2 — ES, IT, PT)
    { countryCode: "ES", method: "standard", priceCents: 990, etaDaysMin: 4, etaDaysMax: 7, freeAboveCents: 10000, active: true },
    { countryCode: "IT", method: "standard", priceCents: 990, etaDaysMin: 4, etaDaysMax: 7, freeAboveCents: 10000, active: true },
    { countryCode: "PT", method: "standard", priceCents: 990, etaDaysMin: 4, etaDaysMax: 7, freeAboveCents: 10000, active: true },
    // UK (post-Brexit)
    { countryCode: "GB", method: "standard", priceCents: 1490, etaDaysMin: 5, etaDaysMax: 10, freeAboveCents: null, active: true },
    // Switzerland
    { countryCode: "CH", method: "standard", priceCents: 1290, etaDaysMin: 4, etaDaysMax: 8, freeAboveCents: null, active: true },
  ];

  const existingRates = await db.select({ id: shippingRates.id }).from(shippingRates).limit(1);
  if (existingRates.length > 0) {
    console.log("  ⏭  Shipping rates already exist, skipping");
  } else {
    await db.insert(shippingRates).values(seedShippingRates);
    console.log(`  ✓  ${seedShippingRates.length} shipping rates inserted`);
  }

  console.log("\n✅ Seed complete!");
  await client.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
