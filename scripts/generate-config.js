#!/usr/bin/env node
/**
 * Generate _config.yml and CNAME from site.yml
 *
 * Reads: _data/site.yml (or content/site.yml)
 * Writes: _config.yml, CNAME
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse } from 'yaml';

const SITE_YAML_PATHS = ['_data/site.yml', 'content/site.yml'];
const CONFIG_OUTPUT = '_config.yml';
const CNAME_OUTPUT = 'CNAME';

// Jekyll config template - placeholders use {{ site.field }} syntax
const CONFIG_TEMPLATE = `# Site settings - values populated from site.yml
title: {{ site.title }}
tagline: {{ site.tagline }}
description: {{ site.description }}
author: {{ site.author }}
url: {{ site.url }}
baseurl: ""
image: {{ site.image }}
repository: {{ site.repository }}

# Build settings
markdown: kramdown
highlighter: rouge
permalink: /:year/:month/:day/:title/

# Plugins
plugins:
  - jekyll-feed
  - jekyll-seo-tag
  - jekyll-redirect-from

# Exclude from processing
exclude:
  - Gemfile
  - Gemfile.lock
  - README.md
  - vendor
  - node_modules
  - src
  - scripts
  - worker
  - content
  - drafts
  - package.json
  - package-lock.json
  - tsconfig.json
  - vite.config.ts
  - postcss.config.js
  - requirements.txt
  - Makefile
  - context-chunks.json
  - system-prompt.md
  - CLAUDE.local.md
  - "*.log"
  - .husky
  - .github

# Explicitly include built assets (since they're gitignored but built in CI)
include:
  - assets/js/dist

# Collections
collections:
  posts:
    output: true

# Defaults
defaults:
  - scope:
      path: ""
    values:
      image: {{ site.image }}
  - scope:
      path: ""
      type: "posts"
    values:
      layout: "post"
`;

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

// Replace placeholders {{ site.field }}
let output = CONFIG_TEMPLATE;
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

// Generate CNAME for custom domains only. Sites hosted at *.github.io
// must NOT have a CNAME — Pages uses its presence as the signal that a
// custom domain is configured, so writing one for username.github.io
// breaks the deployment.
const isGithubPagesHost = (host) =>
  /\.github\.io$/i.test(host) || /^github\.io$/i.test(host);

if (site.domain) {
  if (isGithubPagesHost(site.domain)) {
    console.log(`Skipping ${CNAME_OUTPUT}: ${site.domain} is a github.io host`);
  } else {
    writeFileSync(CNAME_OUTPUT, site.domain + '\n');
    console.log(`Generated ${CNAME_OUTPUT}: ${site.domain}`);
  }
} else {
  // Extract domain from URL if not explicitly set
  try {
    const url = new URL(site.url);
    if (isGithubPagesHost(url.hostname)) {
      console.log(`Skipping ${CNAME_OUTPUT}: ${url.hostname} is a github.io host`);
    } else {
      writeFileSync(CNAME_OUTPUT, url.hostname + '\n');
      console.log(`Generated ${CNAME_OUTPUT}: ${url.hostname} (from url)`);
    }
  } catch (e) {
    console.warn('Warning: Could not generate CNAME - no domain or valid url specified');
  }
}
