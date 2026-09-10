/**
 * Client del database (Neon Postgres via Drizzle).
 *
 * Inizializzazione pigra con una semplice `let` a livello di modulo — NON un `Proxy`:
 * i Proxy attorno al client rompono alcune librerie che ispezionano l'oggetto db
 * (vedi skill vercel-storage). `getDb()` va chiamata dentro le funzioni, non a livello
 * di modulo, così `next build` non esplode se `DATABASE_URL` non è ancora impostata.
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

type Db = ReturnType<typeof creaDb>;

function creaDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL mancante — il database Neon non è ancora configurato');
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let _db: Db | null = null;

export function getDb(): Db {
  if (!_db) _db = creaDb();
  return _db;
}

export { schema };
