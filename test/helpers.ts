import { spawnSync, type SpawnSyncReturns } from 'child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '..');

export type RunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

/**
 * Spawn a Node script (resolved relative to REPO_ROOT) inside a temp
 * working directory. The temp dir is the cwd for the child process, so
 * scripts that read relative paths (e.g. `_data/site.yml`, `content/...`)
 * see only the fixture files we put there.
 */
export function runScript(
  relScript: string,
  cwd: string,
  env: Record<string, string | undefined> = {}
): RunResult {
  const result: SpawnSyncReturns<Buffer> = spawnSync(
    process.execPath,
    [resolve(REPO_ROOT, relScript)],
    {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  return {
    status: result.status,
    stdout: result.stdout?.toString('utf-8') ?? '',
    stderr: result.stderr?.toString('utf-8') ?? '',
  };
}

/**
 * Make a temp working directory. Caller cleans up via the returned
 * `cleanup()` function (typically inside afterEach).
 */
export function makeTempCwd(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'ellyseum-test-'));
  // Ensure node_modules from the real repo is reachable so scripts that
  // import 'yaml' resolve. Symlinking is cheaper than copying.
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/**
 * Drop a file (creating intermediate directories) inside the temp cwd.
 */
export function fixture(cwd: string, relPath: string, body: string): void {
  const full = join(cwd, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf-8');
}

/**
 * Read a generated file from the temp cwd. Returns null if absent.
 */
export function readGenerated(cwd: string, relPath: string): string | null {
  const full = join(cwd, relPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf-8');
}

/**
 * Symlink the repo's node_modules into the temp dir so child scripts can
 * import third-party packages (yaml, etc.). Cheaper than copying.
 */
export function linkNodeModules(cwd: string): void {
  const link = join(cwd, 'node_modules');
  if (existsSync(link)) return;
  // Create a symlink from cwd/node_modules → REPO_ROOT/node_modules
  spawnSync('ln', ['-s', join(REPO_ROOT, 'node_modules'), link]);
}
