/**
 * Seed script — run with: npx tsx src/db/seed.ts
 * Inserts sample products + shipping rates if they don't already exist.
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
      tagline: "Le classique indémodable. Résistant à l'eau et aux UV.",
      description: `## Stickers Vinyle Découpé

Le classique indémodable. Découpés précisément selon la forme de votre design, ces stickers en vinyle blanc mat adhèrent sur toutes les surfaces lisses.

**Idéal pour :** logos, illustrations, packaging, déco murale, vélos, casques.

- Vinyle blanc mat haute qualité
- Résistant à l'eau et aux UV
- Colle repositionnable ou permanente au choix
- Fond transparent ou blanc`,
      status: "active" as const,
      sortOrder: 1,
    },
    {
      slug: "stickers-holographiques",
      name: "Stickers Holographiques",
      tagline: "Effet arc-en-ciel irisé pour un résultat premium.",
      description: `## Stickers Holographiques

Un effet wow garanti. Les stickers holographiques réfléchissent la lumière pour créer un effet arc-en-ciel irisé qui attire tous les regards.

**Idéal pour :** éditions limitées, produits premium, packaging luxe, cadeaux.

- Film holographique prismatique
- Finition ultra-brillante
- Résistant à l'eau et aux rayures
- Disponible en fond transparent ou argent`,
      status: "active" as const,
      sortOrder: 2,
    },
    {
      slug: "stickers-transparents",
      name: "Stickers Transparents",
      tagline: "Le fameux No-Label Look — discret et professionnel.",
      description: `## Stickers Transparents

Le fameux "no-label look". Sur fond transparent, seul votre design est visible pour un rendu ultra-professionnel et minimaliste.

**Idéal pour :** cosmétiques, bouteilles, packaging premium, fenêtres.

- Film transparent haute clarté
- Résistant à l'eau et aux huiles
- Encres pigmentées haute définition
- Finition gloss ou mat`,
      status: "active" as const,
      sortOrder: 3,
    },
  ];

  for (const p of seedProducts) {
    const existing = await db.select({ id: products.id }).from(products).where(eq(products.slug, p.slug)).limit(1);
    if (!existing[0]) {
      await db.insert(products).values(p);
      console.log(`  ✅ Created: ${p.name}`);
    } else {
      console.log(`  ⏭  Skipped (exists): ${p.name}`);
    }
  }

  console.log("\n🚢 Seeding shipping rates...");

  const seedRates = [
    { countryCode: "FR", method: "standard", priceCents: 490, etaDaysMin: 3, etaDaysMax: 5, freeAboveCents: 5000 },
    { countryCode: "FR", method: "express",  priceCents: 990, etaDaysMin: 1, etaDaysMax: 2, freeAboveCents: null },
    { countryCode: "BE", method: "standard", priceCents: 690, etaDaysMin: 4, etaDaysMax: 7, freeAboveCents: 7500 },
    { countryCode: "DE", method: "standard", priceCents: 690, etaDaysMin: 4, etaDaysMax: 7, freeAboveCents: 7500 },
    { countryCode: "ES", method: "standard", priceCents: 790, etaDaysMin: 5, etaDaysMax: 8, freeAboveCents: 9000 },
    { countryCode: "IT", method: "standard", priceCents: 790, etaDaysMin: 5, etaDaysMax: 8, freeAboveCents: 9000 },
    { countryCode: "GB", method: "standard", priceCents: 990, etaDaysMin: 5, etaDaysMax: 10, freeAboveCents: 12000 },
  ];

  for (const r of seedRates) {
    const existing = await db
      .select({ id: shippingRates.id })
      .from(shippingRates)
      .where(eq(shippingRates.countryCode, r.countryCode))
      .limit(1);
    if (!existing[0]) {
      await db.insert(shippingRates).values({ ...r, active: true });
      console.log(`  ✅ Created rate: ${r.countryCode} ${r.method}`);
    } else {
      console.log(`  ⏭  Skipped (exists): ${r.countryCode} ${r.method}`);
    }
  }

  await client.end();
  console.log("\n🎉 Seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
