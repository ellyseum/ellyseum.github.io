/**
 * Tests for scripts/inject-chunks.js — generates src/data/context-chunks.ts
 * from a chunks JSON file (or env var, or empty stub).
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { fixture, makeTempCwd, readGenerated, runScript, linkNodeModules } from '../helpers';

const SCRIPT = 'scripts/inject-chunks.js';

const sampleChunks = JSON.stringify({
  chunks: [
    { id: 'a', category: 'tech', content: 'hello world', keywords: ['hello'] },
  ],
  categories: ['tech', 'life'],
});

describe('inject-chunks', () => {
  let tmp: { dir: string; cleanup: () => void };

  beforeEach(() => {
    tmp = makeTempCwd();
    linkNodeModules(tmp.dir);
  });

  afterEach(() => tmp.cleanup());

  it('reads context-chunks.json from the repo root', () => {
    fixture(tmp.dir, 'context-chunks.json', sampleChunks);
    const { status } = runScript(SCRIPT, tmp.dir);
    expect(status).toBe(0);

    const out = readGenerated(tmp.dir, 'src/data/context-chunks.ts') ?? '';
    expect(out).toContain('"id": "a"');
    expect(out).toContain('"hello world"');
    expect(out).toContain('"tech"');
  });

  it('prefers content/context-chunks.json over the root copy', () => {
    const stale = JSON.stringify({ chunks: [{ id: 'stale', category: 'x', content: '', keywords: [] }], categories: [] });
    fixture(tmp.dir, 'context-chunks.json', stale);
    fixture(tmp.dir, 'content/context-chunks.json', sampleChunks);
    const { status, stdout } = runScript(SCRIPT, tmp.dir);
    expect(status).toBe(0);
    expect(stdout).toMatch(/content\/context-chunks\.json/);

    const out = readGenerated(tmp.dir, 'src/data/context-chunks.ts') ?? '';
    expect(out).toContain('"id": "a"');
    expect(out).not.toContain('"id": "stale"');
  });

  it('prefers CONTEXT_CHUNKS env var over both files', () => {
    fixture(tmp.dir, 'context-chunks.json', sampleChunks);
    fixture(tmp.dir, 'content/context-chunks.json', sampleChunks);
    const envChunks = JSON.stringify({
      chunks: [{ id: 'env', category: 'x', content: 'from env', keywords: [] }],
      categories: ['x'],
    });
    const { status, stdout } = runScript(SCRIPT, tmp.dir, { CONTEXT_CHUNKS: envChunks });
    expect(status).toBe(0);
    expect(stdout).toMatch(/from environment/);

    const out = readGenerated(tmp.dir, 'src/data/context-chunks.ts') ?? '';
    expect(out).toContain('"id": "env"');
  });

  it('emits an empty stub when no source is available', () => {
    const { status, stderr } = runScript(SCRIPT, tmp.dir);
    expect(status).toBe(0);
    expect(stderr).toMatch(/empty stub/i);

    const out = readGenerated(tmp.dir, 'src/data/context-chunks.ts') ?? '';
    expect(out).toContain('export const CONTEXT_CHUNKS: ContextChunk[] = []');
    expect(out).toContain('export const CATEGORIES = []');
  });
});
