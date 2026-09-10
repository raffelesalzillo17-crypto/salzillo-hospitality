/**
 * Autenticazione del nuovo sistema (/nuovo). Rifà "bene" quello che oggi è frammentato in
 * tre pezzi (chiave plancia, accessi.ts, cron secret): un utente per persona, ruoli, e
 * permessi per immobile.
 *
 *  - Titolare (Raffaele): vede e fa tutto.
 *  - Collaboratore: gli immobili che gli sono stati assegnati (permessi_immobile).
 *  - Proprietario: solo il suo immobile, in sola lettura.
 *  - Pulizie: solo il calendario pulizie e le sue conferme.
 *
 * scrypt per le password (nativo), token di sessione HMAC firmato (stateless). Stesso spirito
 * di src/lib/accessi.ts, che resta nel repo come riferimento ma non è più collegato a niente.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { utenti, permessiImmobile, immobili, alloggi } from './schema';

export const COOKIE = 'sh_sessione';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function segreto(): string {
  return process.env.ACCESSI_SECRET || process.env.PLANCIA_ACCESS_KEY || 'dev-secret-non-usare-in-produzione';
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}
export function verificaPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(scryptSync(pw, salt, 64).toString('hex'), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function creaToken(utenteId: string): string {
  const scade = Date.now() + TTL_MS;
  const payload = `${utenteId}:${scade}`;
  const firma = createHmac('sha256', segreto()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${firma}`).toString('base64url');
}
export function verificaToken(token: string): string | null {
  try {
    const [utenteId, scadeStr, firma] = Buffer.from(token, 'base64url').toString('utf8').split(':');
    const attesa = createHmac('sha256', segreto()).update(`${utenteId}:${scadeStr}`).digest('hex');
    const a = Buffer.from(firma, 'hex'), b = Buffer.from(attesa, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Date.now() > Number(scadeStr)) return null;
    return utenteId;
  } catch { return null; }
}

export type Sessione = {
  id: string; username: string; nome: string; ruolo: string; proprietarioId: string | null;
  immobiliVisibili: string[] | 'tutti';       // id immobili, o 'tutti' per il titolare
  immobiliModificabili: string[] | 'tutti';
  vedeFinanziario: boolean;
};

/** Ricava la sessione dalla richiesta. Ritorna null se non autenticato/non valido. */
export async function leggiSessione(req: NextRequest): Promise<Sessione | null> {
  const token = req.cookies.get(COOKIE)?.value;
  const utenteId = token ? verificaToken(token) : null;
  if (!utenteId) return null;

  const db = getDb();
  const [u] = await db.select().from(utenti).where(eq(utenti.id, utenteId));
  if (!u || !u.attivo) return null;

  if (u.ruolo === 'Titolare') {
    return { id: u.id, username: u.username, nome: u.nome, ruolo: u.ruolo, proprietarioId: u.proprietario_id,
      immobiliVisibili: 'tutti', immobiliModificabili: 'tutti', vedeFinanziario: true };
  }

  const perm = await db.select().from(permessiImmobile).where(eq(permessiImmobile.utente_id, u.id));
  let visibili = perm.filter((p) => p.puo_vedere).map((p) => p.immobile_id);
  const modificabili = perm.filter((p) => p.puo_modificare).map((p) => p.immobile_id);
  const vedeFin = perm.some((p) => p.puo_vedere_finanziario);

  // Proprietario: i suoi immobili anche senza riga esplicita in permessi_immobile
  if (u.ruolo === 'Proprietario' && u.proprietario_id) {
    const suoi = await db.select({ id: immobili.id }).from(immobili).where(eq(immobili.proprietario_id, u.proprietario_id));
    visibili = [...new Set([...visibili, ...suoi.map((x) => x.id)])];
  }

  return { id: u.id, username: u.username, nome: u.nome, ruolo: u.ruolo, proprietarioId: u.proprietario_id,
    immobiliVisibili: visibili, immobiliModificabili: modificabili,
    vedeFinanziario: u.ruolo === 'Proprietario' ? true : vedeFin };
}

/** Come leggiSessione, ma se non autenticato ritorna una NextResponse 401 pronta. */
export async function richiediSessione(req: NextRequest): Promise<{ sessione: Sessione } | { risposta: NextResponse }> {
  const sessione = await leggiSessione(req);
  if (!sessione) return { risposta: NextResponse.json({ ok: false, error: 'Accesso richiesto' }, { status: 401 }) };
  return { sessione };
}

/** Filtra un elenco (di qualcosa che ha immobileId) secondo cosa può vedere la sessione. */
export function filtraPerVisibilita<T extends { immobileId?: string | null }>(items: T[], sess: Sessione): T[] {
  if (sess.immobiliVisibili === 'tutti') return items;
  const set = new Set(sess.immobiliVisibili);
  return items.filter((i) => i.immobileId && set.has(i.immobileId));
}

/** Id degli alloggi che la sessione può vedere (per filtrare le prenotazioni). */
export async function alloggiVisibili(sess: Sessione): Promise<Set<string> | 'tutti'> {
  if (sess.immobiliVisibili === 'tutti') return 'tutti';
  const db = getDb();
  const set = new Set(sess.immobiliVisibili);
  const rows = await db.select({ id: alloggi.id, immobileId: alloggi.immobile_id }).from(alloggi);
  return new Set(rows.filter((a) => set.has(a.immobileId)).map((a) => a.id));
}
