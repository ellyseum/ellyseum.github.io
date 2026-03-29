import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,js}'],
    exclude: ['node_modules', '_site', 'assets/js/dist', 'content', 'worker'],
    testTimeout: 15000,
    pool: 'forks', // child-process tests spawn subprocesses; isolate via forks
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
