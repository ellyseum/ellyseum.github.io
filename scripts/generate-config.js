#!/usr/bin/env node
/**
 * Generate _config.yml and CNAME from site.yml
 *
 * Reads: _data/site.yml (or content/site.yml)
 * Writes: _config.yml, CNAME
 *
 * Template placeholders use {{ site.field }} syntax
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse } from 'yaml';

const SITE_YAML_PATHS = ['_data/site.yml', 'content/site.yml'];
const CONFIG_TEMPLATE = '_config.yml.tmpl';
const CONFIG_OUTPUT = '_config.yml';
const CNAME_OUTPUT = 'CNAME';

// Find site.yml
let siteYamlPath = null;
for (const path of SITE_YAML_PATHS) {
  if (existsSync(path)) {
    siteYamlPath = path;
    break;
  }
}

if (!siteYamlPath) {
  console.error('Error: No site.yml found in _data/ or content/');
  process.exit(1);
}

// Read and parse site.yml
const siteYaml = readFileSync(siteYamlPath, 'utf-8');
const config = parse(siteYaml);

if (!config.site) {
  console.error('Error: No "site" section found in site.yml');
  process.exit(1);
}

const site = config.site;

// Check required fields
const required = ['title', 'description', 'author', 'url', 'repository'];
for (const field of required) {
  if (!site[field]) {
    console.error(`Error: Missing required field "site.${field}" in site.yml`);
    process.exit(1);
  }
}

// Read template
if (!existsSync(CONFIG_TEMPLATE)) {
  console.error(`Error: Template file ${CONFIG_TEMPLATE} not found`);
  process.exit(1);
}

const template = readFileSync(CONFIG_TEMPLATE, 'utf-8');

// Replace placeholders {{ site.field }}
let output = template;
const placeholderRegex = /\{\{\s*site\.(\w+)\s*\}\}/g;
output = output.replace(placeholderRegex, (match, field) => {
  if (site[field] !== undefined) {
    return site[field];
  }
  console.warn(`Warning: Placeholder ${match} has no value in site.yml`);
  return '';
});

// Write _config.yml
writeFileSync(CONFIG_OUTPUT, output);
console.log(`Generated ${CONFIG_OUTPUT} from ${siteYamlPath}`);

// Generate CNAME if domain is specified
if (site.domain) {
  writeFileSync(CNAME_OUTPUT, site.domain + '\n');
  console.log(`Generated ${CNAME_OUTPUT}: ${site.domain}`);
} else {
  // Extract domain from URL if not explicitly set
  try {
    const url = new URL(site.url);
    writeFileSync(CNAME_OUTPUT, url.hostname + '\n');
    console.log(`Generated ${CNAME_OUTPUT}: ${url.hostname} (from url)`);
  } catch (e) {
    console.warn('Warning: Could not generate CNAME - no domain or valid url specified');
  }
}
