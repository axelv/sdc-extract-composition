#!/usr/bin/env node
/**
 * Strip specific extensions from a Questionnaire JSON file.
 * Usage: node scripts/strip-extensions.js <file.json> [--in-place]
 */
import { readFileSync, writeFileSync } from "node:fs";

const STRIP_URLS = [
  "http://fhir.tiro.health/StructureDefinition/narrative-template-snippet",
];

function stripExtensions(obj) {
  if (Array.isArray(obj)) {
    return obj.map(stripExtensions);
  }
  if (obj && typeof obj === "object") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "extension" && Array.isArray(value)) {
        const filtered = value.filter(
          (ext) => !STRIP_URLS.includes(ext.url)
        );
        if (filtered.length > 0) {
          result[key] = stripExtensions(filtered);
        }
      } else {
        result[key] = stripExtensions(value);
      }
    }
    return result;
  }
  return obj;
}

const args = process.argv.slice(2);
const inPlace = args.includes("--in-place");
const file = args.find((a) => !a.startsWith("--"));

if (!file) {
  console.error("Usage: node strip-extensions.js <file.json> [--in-place]");
  process.exit(1);
}

const data = JSON.parse(readFileSync(file, "utf-8"));
const stripped = stripExtensions(data);

if (inPlace) {
  writeFileSync(file, JSON.stringify(stripped, null, 2) + "\n");
  console.error(`Stripped extensions from ${file}`);
} else {
  console.log(JSON.stringify(stripped, null, 2));
}
