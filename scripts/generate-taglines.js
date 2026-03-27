#!/usr/bin/env node
/**
 * Generate taglines.ts from site.yml
 * Reads the taglines array and outputs a TypeScript file
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { parse } from 'yaml';
import { dirname } from 'path';

const SITE_YML = '_data/site.yml';
const OUTPUT = 'src/data/taglines.ts';

try {
  const yaml = readFileSync(SITE_YML, 'utf-8');
  const config = parse(yaml);

  // taglines is optional — emit an empty array if not configured so
  // builds don't fail on a barebones site.yml.
  const taglines = Array.isArray(config.taglines) ? config.taglines : [];

  const output = `// Auto-generated from site.yml - do not edit directly
export const TAGLINES: string[] = ${JSON.stringify(taglines, null, 2)};
`;

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, output);
  console.log(`Generated ${OUTPUT} with ${taglines.length} taglines`);
} catch (err) {
  console.error('Error generating taglines:', err.message);
  process.exit(1);
}
