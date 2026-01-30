/**
 * Post-build script: copies Vite manifest to _data/ for Jekyll to read
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, '../assets/js/dist/.vite/manifest.json');
const outputPath = resolve(__dirname, '../_data/vite-manifest.json');

// Ensure _data directory exists
mkdirSync(resolve(__dirname, '../_data'), { recursive: true });

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
console.log('Copied Vite manifest to _data/vite-manifest.json');
