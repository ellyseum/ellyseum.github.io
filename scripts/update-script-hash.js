/**
 * Post-build script: reads Vite manifest to get the hashed main.js filename
 * and updates the Jekyll layout to reference it.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, '../assets/js/dist/.vite/manifest.json');
const layoutPath = resolve(__dirname, '../_layouts/default.html');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const mainEntry = manifest['src/main.ts'];
if (!mainEntry) {
  console.error('No main entry found in Vite manifest');
  process.exit(1);
}

const hashedFile = mainEntry.file; // e.g. "main-Ab12Cd34.js"
const layout = readFileSync(layoutPath, 'utf-8');
const updated = layout.replace(
  /src="{{ '\/assets\/js\/dist\/main[^']*' \| relative_url }}"/,
  `src="{{ '/assets/js/dist/${hashedFile}' | relative_url }}"`
);

writeFileSync(layoutPath, updated);
console.log(`Updated layout to reference ${hashedFile}`);
