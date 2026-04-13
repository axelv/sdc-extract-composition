/**
 * Copy iteration questionnaire-extract.json files into src/iterations/
 * so they are bundled by Vite's import.meta.glob at build time.
 * Runs as a prebuild step (works both locally and on Vercel).
 */
import { readdirSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iterationsSource = join(__dirname, "../../iterations");
const iterationsTarget = join(__dirname, "../src/iterations");

if (!existsSync(iterationsSource)) {
  console.log("No iterations directory found, skipping copy.");
  process.exit(0);
}

mkdirSync(iterationsTarget, { recursive: true });

for (const dir of readdirSync(iterationsSource, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const src = join(iterationsSource, dir.name, "questionnaire-extract.json");
  if (!existsSync(src)) continue;
  const destDir = join(iterationsTarget, dir.name);
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, join(destDir, "questionnaire-extract.json"));
  console.log(`Copied ${dir.name}/questionnaire-extract.json`);

  // Also copy questionnaire-response.json if present
  const qrSrc = join(iterationsSource, dir.name, "questionnaire-response.json");
  if (existsSync(qrSrc)) {
    copyFileSync(qrSrc, join(destDir, "questionnaire-response.json"));
    console.log(`Copied ${dir.name}/questionnaire-response.json`);
  }
}
