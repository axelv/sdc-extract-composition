import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dirname, 'vendor/fhirpath-rs/_rust_bg.wasm');
const wasmBuffer = readFileSync(wasmPath);

const { default: init, QuestionnaireIndex } = await import('./vendor/fhirpath-rs/_rust.js');
await init(wasmBuffer);

const questionnaire = JSON.parse(
  readFileSync('./src/iterations/08-editor-test/questionnaire-extract.json', 'utf-8')
);

const index = new QuestionnaireIndex(JSON.stringify(questionnaire));

console.log("=== Checking what info WASM completions provide ===\n");

const items = index.generate_completions("%resource");
console.log("All items from %resource:\n");

for (const item of items) {
  if (item.kind === "value") {
    console.log(`linkId: ${item.link_id}`);
    console.log(`  label: ${item.label}`);
    console.log(`  insert_text: ${item.insert_text}`);
    console.log(`  traverses_repeating: ${item.traverses_repeating}`);
    console.log();
  }
}
