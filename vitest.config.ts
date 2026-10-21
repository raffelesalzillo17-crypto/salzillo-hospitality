import { defineConfig } from 'vitest/config';

// Test automatici: calcoli di denaro, tracciato Alloggiati, controllo sovrapposizioni, motore di
// regole, disegno dei pannelli. I test che richiedono il database (RUN_DB_TESTS=1) sono in
// tests/*.db.test.ts.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
