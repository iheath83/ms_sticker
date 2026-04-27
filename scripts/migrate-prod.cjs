/**
 * Minimal CJS migration runner for production Docker container.
 * Called by the `migrate` service in docker-compose.prod.yml.
 * Uses drizzle-kit programmatic API via child_process.
 */

const { execSync } = require("child_process");

console.log("▶ [migrate] Starting Drizzle migrations …");

try {
  execSync("npx drizzle-kit migrate", {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
  console.log("✅ [migrate] Migrations complete.");
} catch (err) {
  console.error("❌ [migrate] Migration failed:", err.message);
  process.exit(1);
}
