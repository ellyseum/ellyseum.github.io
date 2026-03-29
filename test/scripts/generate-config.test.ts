/**
 * Tests for scripts/generate-config.js — produces _config.yml and CNAME
 * from a site.yml file. Particular focus on CNAME logic since that
 * controls GitHub Pages domain routing and has had a couple of regressions.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fixture, makeTempCwd, readGenerated, runScript, linkNodeModules } from '../helpers';

const SCRIPT = 'scripts/generate-config.js';

const baseSite = `
site:
  title: "Test Blog"
  description: "Test description"
  author: "Test Author"
  url: "https://example.com"
  domain: "example.com"
  repository: "user/repo"
`;

describe('generate-config', () => {
  let tmp: { dir: string; cleanup: () => void };

  beforeEach(() => {
    tmp = makeTempCwd();
    linkNodeModules(tmp.dir);
  });

  afterEach(() => tmp.cleanup());

  it('emits _config.yml with values populated from site.yml', () => {
    fixture(tmp.dir, '_data/site.yml', baseSite);

    const { status } = runScript(SCRIPT, tmp.dir);
    expect(status).toBe(0);

    const config = readGenerated(tmp.dir, '_config.yml') ?? '';
    expect(config).toContain('title: Test Blog');
    expect(config).toContain('author: Test Author');
    expect(config).toContain('url: https://example.com');
    expect(config).toContain('repository: user/repo');
  });

  it('writes CNAME for a custom domain', () => {
    fixture(tmp.dir, '_data/site.yml', baseSite);
    runScript(SCRIPT, tmp.dir);
    expect(readGenerated(tmp.dir, 'CNAME')).toBe('example.com\n');
  });

  it('does NOT write CNAME for username.github.io URLs', () => {
    const yml = `
site:
  title: "Test"
  description: "T"
  author: "T"
  url: "https://user.github.io"
  repository: "user/user.github.io"
`;
    fixture(tmp.dir, '_data/site.yml', yml);
    const { status } = runScript(SCRIPT, tmp.dir);
    expect(status).toBe(0);
    expect(existsSync(join(tmp.dir, 'CNAME'))).toBe(false);
  });

  it('removes a stale CNAME when the site moves to github.io', () => {
    // Pre-existing CNAME from an earlier custom-domain build
    writeFileSync(join(tmp.dir, 'CNAME'), 'old-domain.com\n');

    const yml = `
site:
  title: "Test"
  description: "T"
  author: "T"
  url: "https://user.github.io"
  repository: "user/user.github.io"
`;
    fixture(tmp.dir, '_data/site.yml', yml);
    runScript(SCRIPT, tmp.dir);
    expect(existsSync(join(tmp.dir, 'CNAME'))).toBe(false);
  });

  it('extracts CNAME from site.url when site.domain is absent', () => {
    const yml = `
site:
  title: "T"
  description: "T"
  author: "T"
  url: "https://blog.custom.com"
  repository: "u/r"
`;
    fixture(tmp.dir, '_data/site.yml', yml);
    runScript(SCRIPT, tmp.dir);
    expect(readGenerated(tmp.dir, 'CNAME')).toBe('blog.custom.com\n');
  });

  it('fails when required fields are missing', () => {
    fixture(tmp.dir, '_data/site.yml', `
site:
  title: "T"
  url: "https://e.com"
`);
    const { status, stderr } = runScript(SCRIPT, tmp.dir);
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/missing required field/i);
  });

  it('reads from content/site.yml when _data/site.yml is absent', () => {
    fixture(tmp.dir, 'content/site.yml', baseSite);
    const { status } = runScript(SCRIPT, tmp.dir);
    expect(status).toBe(0);
    expect(readGenerated(tmp.dir, '_config.yml')).toContain('title: Test Blog');
  });

  it('exits 1 when no site.yml exists in either location', () => {
    const { status, stderr } = runScript(SCRIPT, tmp.dir);
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/no site\.yml/i);
  });
});
