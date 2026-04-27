/**
 * Compile MJML email templates to HTML.
 * Run: npm run email:compile
 *
 * Output: src/lib/emails/compiled/<name>.html
 * These compiled HTML files can be used as static fallback templates.
 * The runtime system uses the block-based renderer (email-renderer.ts) which
 * is editable via the admin email editor.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const TEMPLATES_DIR = join(ROOT, "src/lib/emails/templates");
const OUTPUT_DIR = join(ROOT, "src/lib/emails/compiled");

// mjml is CommonJS — use createRequire for ESM compat
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mjml = require("mjml");

mkdirSync(OUTPUT_DIR, { recursive: true });

const files = readdirSync(TEMPLATES_DIR).filter(
  (f) => f.endsWith(".mjml") && !f.startsWith("_"),
);

let compiled = 0;
let errors = 0;

for (const file of files) {
  const inputPath = join(TEMPLATES_DIR, file);
  const outputPath = join(OUTPUT_DIR, basename(file, ".mjml") + ".html");

  try {
    const source = readFileSync(inputPath, "utf-8");
    const result = await mjml(source, {
      validationLevel: "strict",
      filePath: inputPath,
    });

    if (result.errors?.length > 0) {
      console.error(`\n⚠️  ${file} has warnings:`);
      for (const e of result.errors) {
        console.error("  -", e.formattedMessage);
      }
    }

    writeFileSync(outputPath, result.html, "utf-8");
    console.log(`✅ ${file} → compiled/${basename(file, ".mjml")}.html`);
    compiled++;
  } catch (err) {
    console.error(`❌ ${file}: ${err instanceof Error ? err.message : String(err)}`);
    errors++;
  }
}

console.log(`\n${compiled} template(s) compiled${errors > 0 ? `, ${errors} error(s)` : ""}.`);
if (errors > 0) process.exit(1);
