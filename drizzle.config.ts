import type { Config } from 'drizzle-kit';

// Configurazione per drizzle-kit (creazione/aggiornamento delle tabelle su Neon).
// drizzle-kit NON carica .env.local da solo: i comandi si lanciano con
//   npx dotenv -e .env.local -- npx drizzle-kit push
// (vedi skill vercel-storage).

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
