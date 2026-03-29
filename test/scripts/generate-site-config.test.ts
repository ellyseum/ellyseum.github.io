/**
 * Tests for scripts/generate-site-config.js — emits src/data/site-config.ts
 * for the in-browser CMS to consume. Coverage focuses on the cms.* knobs
 * and their fallback behavior.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { fixture, makeTempCwd, readGenerated, runScript, linkNodeModules } from '../helpers';

const SCRIPT = 'scripts/generate-site-config.js';

const fullSite = `
site:
  title: "T"
  description: "T"
  author: "Author Name"
  url: "https://e.com"
  domain: "e.com"
  repository: "alice/blog"
contact:
  email: "a@e.com"
  github: "https://github.com/alice"
  linkedin: "https://linkedin.com/in/alice"
  portfolio: "https://alice.dev"
`;

describe('generate-site-config', () => {
  let tmp: { dir: string; cleanup: () => void };

  beforeEach(() => {
    tmp = makeTempCwd();
    linkNodeModules(tmp.dir);
  });

  afterEach(() => tmp.cleanup());

  it('emits SITE_CONFIG with author, contact, and repository fields', () => {
    fixture(tmp.dir, '_data/site.yml', fullSite);
    const { status } = runScript(SCRIPT, tmp.dir);
    expect(status).toBe(0);

    const out = readGenerated(tmp.dir, 'src/data/site-config.ts') ?? '';
    expect(out).toContain('export const SITE_CONFIG');
    expect(out).toContain('"Author Name"');
    expect(out).toContain('"a@e.com"');
    expect(out).toContain('"alice/blog"');
  });

  it('emits empty cms.* fields when no cms block is configured', () => {
    fixture(tmp.dir, '_data/site.yml', fullSite);
    runScript(SCRIPT, tmp.dir);
    const out = readGenerated(tmp.dir, 'src/data/site-config.ts') ?? '';
    expect(out).toContain('content_repo: ""');
    expect(out).toContain('github_owner: ""');
    expect(out).toContain('content_posts_path: ""');
    expect(out).toContain('content_drafts_path: ""');
  });

  it('emits cms.* values when configured', () => {
    fixture(tmp.dir, '_data/site.yml', fullSite + `
cms:
  content_repo: "my-content"
  github_owner: "alice"
  content_posts_path: "blog"
  content_drafts_path: "_drafts"
`);
    runScript(SCRIPT, tmp.dir);
    const out = readGenerated(tmp.dir, 'src/data/site-config.ts') ?? '';
    expect(out).toContain('content_repo: "my-content"');
    expect(out).toContain('github_owner: "alice"');
    expect(out).toContain('content_posts_path: "blog"');
    expect(out).toContain('content_drafts_path: "_drafts"');
  });

  it('emits site.repository so the CMS can fall back to it', () => {
    fixture(tmp.dir, '_data/site.yml', fullSite);
    runScript(SCRIPT, tmp.dir);
    const out = readGenerated(tmp.dir, 'src/data/site-config.ts') ?? '';
    expect(out).toContain('repository: "alice/blog"');
  });

  it('fails when contact section is missing', () => {
    fixture(tmp.dir, '_data/site.yml', `
site:
  title: "T"
  description: "T"
  author: "T"
  url: "https://e.com"
  repository: "u/r"
`);
    const { status, stderr } = runScript(SCRIPT, tmp.dir);
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/contact/i);
  });
});
