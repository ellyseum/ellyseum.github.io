# Tests

Run with `npm test` (single-pass) or `npm run test:watch`.

Two layers:

- `test/scripts/` — black-box tests for the build scripts under `scripts/`.
  Each test sets up a temp working directory with fixture files
  (`site.yml`, `system-prompt.md`, etc.), runs the script as a subprocess,
  and asserts on the generated output. This exercises exactly the same
  code paths CI hits.
- `test/cms/` — unit tests for `src/terminal/github.ts` (path resolution,
  slug matching, frontmatter regex). These mock `fetch` and call the
  client methods directly.

The test runner is [vitest](https://vitest.dev/). Configuration lives in
`vitest.config.ts` at the repo root.
