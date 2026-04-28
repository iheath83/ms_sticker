/**
 * Production migration runner — uses the `postgres` package directly with raw SQL files.
 * drizzle-orm is bundled into Next.js chunks in standalone mode and not importable here,
 * but postgres IS available as a runtime dependency in the standalone node_modules.
 */

const path = require("path");
const fs = require("fs");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ [migrate] DATABASE_URL is not set");
  process.exit(1);
}

async function main() {
  console.log("▶ [migrate] Starting migrations …");

  const { default: postgres } = await import("postgres");
  const sql = postgres(databaseUrl, { max: 1 });

  // Drizzle migration tracking table
  await sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id       SERIAL PRIMARY KEY,
      hash     TEXT   NOT NULL UNIQUE,
      created_at BIGINT
    )
  `;

  const migrationsDir = path.join(__dirname, "../src/db/migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("  ⚠  No migration files found in", migrationsDir);
  }

  for (const file of files) {
    const hash = file.replace(/\.sql$/, "");
    const [existing] = await sql`
      SELECT id FROM "__drizzle_migrations" WHERE hash = ${hash}
    `;
    if (existing) {
      console.log(`  ⏭  Already applied: ${file}`);
      continue;
    }

    const content = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    // Drizzle splits statements with -->statement-breakpoint
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`  ▶  Applying ${file} (${statements.length} statement(s)) …`);
    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }

    await sql`
      INSERT INTO "__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${Date.now()})
    `;
    console.log(`  ✅ Applied: ${file}`);
  }

  console.log("✅ [migrate] All migrations applied.");
  await sql.end();
}

main().catch((err) => {
  console.error("❌ [migrate] Migration failed:", err.message ?? err);
  process.exit(1);
});
