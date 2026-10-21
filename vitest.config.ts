import { defineConfig } from 'vitest/config';

// Test automatici: calcoli di denaro, tracciato Alloggiati, controllo sovrapposizioni.
// I test che richiedono il database (RUN_DB_TESTS=1) sono in tests/*.db.test.ts.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
