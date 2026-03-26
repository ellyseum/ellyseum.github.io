#!/usr/bin/env node
/**
 * Resolve CMS post/draft paths from site.yml and print as shell vars.
 *
 * Used by fetch-content.sh so the local build pipeline copies posts and
 * drafts from the same locations the in-browser CMS commits to.
 *
 *   eval "$(node scripts/print-cms-paths.js)"
 *   # POSTS_SUBDIR=
 *   # DRAFTS_SUBDIR=drafts
 */

import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';

let cfg = {};
for (const f of ['content/site.yml', '_data/site.yml']) {
  if (existsSync(f)) {
    cfg = parse(readFileSync(f, 'utf-8')) || {};
    break;
  }
}

const cms = cfg.cms || {};
console.log(`POSTS_SUBDIR=${cms.content_posts_path || ''}`);
console.log(`DRAFTS_SUBDIR=${cms.content_drafts_path || 'drafts'}`);
