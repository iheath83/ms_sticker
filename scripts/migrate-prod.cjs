/**
 * Production migration runner — uses drizzle-orm's migrate() API directly.
 * Does NOT require drizzle-kit (devDependency) to be installed.
 */

const path = require("path");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ [migrate] DATABASE_URL is not set");
  process.exit(1);
}

async function main() {
  console.log("▶ [migrate] Starting Drizzle migrations …");

  // Dynamic imports — drizzle-orm and postgres are production dependencies
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/migrator");
  const { default: postgres } = await import("postgres");

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  await migrate(db, {
    migrationsFolder: path.join(__dirname, "src/db/migrations"),
  });

  console.log("✅ [migrate] Migrations complete.");
  await client.end();
}

main().catch((err) => {
  console.error("❌ [migrate] Migration failed:", err.message ?? err);
  process.exit(1);
});
