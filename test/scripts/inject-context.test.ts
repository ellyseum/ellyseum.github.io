/**
 * Tests for scripts/inject-context.js — generates src/data/jocelyn-context.ts
 * with an obfuscated SYSTEM_PROMPT and chat greetings. Coverage focuses on
 * the resolution priority (env > content/ > root) and the skip-if-missing
 * empty-stub path.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { fixture, makeTempCwd, readGenerated, runScript, linkNodeModules } from '../helpers';

const SCRIPT = 'scripts/inject-context.js';

const minimalSiteYml = `
site:
  title: "T"
  url: "https://e.com"
  repository: "u/r"
`;

describe('inject-context', () => {
  let tmp: { dir: string; cleanup: () => void };

  beforeEach(() => {
    tmp = makeTempCwd();
    linkNodeModules(tmp.dir);
    fixture(tmp.dir, '_data/site.yml', minimalSiteYml);
  });

  afterEach(() => tmp.cleanup());

  it('reads system-prompt.md from the repo root', () => {
    fixture(tmp.dir, 'system-prompt.md', 'YOU ARE ROOT PROMPT');
    const { status } = runScript(SCRIPT, tmp.dir);
    expect(status).toBe(0);

    const out = readGenerated(tmp.dir, 'src/data/jocelyn-context.ts') ?? '';
    // The prompt is base64-chunked-and-obfuscated, but the output should
    // still parse and define SYSTEM_PROMPT. We verify presence of the
    // export name and that the file isn't a degenerate stub.
    expect(out).toContain('export const SYSTEM_PROMPT');
    expect(out).not.toContain('export const SYSTEM_PROMPT=_decode("")');
  });

  it('prefers content/system-prompt.md over the repo root copy', () => {
    fixture(tmp.dir, 'system-prompt.md', 'STALE ROOT PROMPT');
    fixture(tmp.dir, 'content/system-prompt.md', 'CANONICAL CONTENT PROMPT');
    const { status, stdout } = runScript(SCRIPT, tmp.dir);
    expect(status).toBe(0);
    expect(stdout).toMatch(/content\/system-prompt\.md/);
  });

  it('prefers SYSTEM_PROMPT env var over either file', () => {
    fixture(tmp.dir, 'system-prompt.md', 'ROOT');
    fixture(tmp.dir, 'content/system-prompt.md', 'CONTENT');
    const { status, stdout } = runScript(SCRIPT, tmp.dir, {
      SYSTEM_PROMPT: 'OVERRIDDEN VIA ENV',
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/SYSTEM_PROMPT from environment/);
  });

  it('emits an empty SYSTEM_PROMPT stub when no source is available', () => {
    // No prompt file anywhere
    const { status, stderr } = runScript(SCRIPT, tmp.dir);
    expect(status).toBe(0);
    expect(stderr).toMatch(/emitting empty stub/i);

    const out = readGenerated(tmp.dir, 'src/data/jocelyn-context.ts') ?? '';
    expect(out).toContain('export const SYSTEM_PROMPT=_decode("")');
  });

  it('reads chat greetings from site.yml when present', () => {
    fixture(tmp.dir, '_data/site.yml', `
site:
  title: "T"
  url: "https://e.com"
  repository: "u/r"
chat:
  greeting_local: "LOCAL HELLO"
  greeting_cloud: "CLOUD HELLO"
`);
    fixture(tmp.dir, 'system-prompt.md', 'P');
    runScript(SCRIPT, tmp.dir);
    const out = readGenerated(tmp.dir, 'src/data/jocelyn-context.ts') ?? '';
    expect(out).toContain('LOCAL HELLO');
    expect(out).toContain('CLOUD HELLO');
  });
});
