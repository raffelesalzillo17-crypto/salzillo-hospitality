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
 * Accesso con link personale (niente password, vedi sotto), token di sessione HMAC firmato (stateless). Stesso spirito
 * di src/lib/accessi.ts, che resta nel repo come riferimento ma non è più collegato a niente.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { utenti, permessiImmobile, immobili, alloggi } from './schema';

export const COOKIE = 'sh_sessione';
// Un anno, e si rinnova da sola a ogni apertura dell'app (vedi /api/nuovo/dati): su un
// dispositivo usato con regolarità il link personale si apre una volta sola.
export const TTL_MS = 365 * 24 * 60 * 60 * 1000;
export const OPZIONI_COOKIE = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: TTL_MS / 1000 };

function segreto(): string {
  return process.env.ACCESSI_SECRET || process.env.PLANCIA_ACCESS_KEY || 'dev-secret-non-usare-in-produzione';
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

// ── Link personale (11/11/2026) ──────────────────────────────────────────────────────────
// Niente più username e password: ogni persona (Titolare, collaboratore, proprietario, pulizie)
// entra con un link solo suo, /api/nuovo/entra?k=<chiave>. La chiave è casuale (32 byte) e sta
// nella colonna `codice_invito` dell'utente, che prima conteneva il codice a 6 lettere del
// "primo accesso" e ora è la chiave permanente. Chi ha il link entra come quella persona:
// per toglierle l'accesso si disattiva l'utente o le si genera un link nuovo (il vecchio muore).
export const LUNGHEZZA_MINIMA_CHIAVE = 40;
export function nuovaChiaveAccesso(): string {
  return randomBytes(32).toString('base64url'); // 43 caratteri
}
export function linkAccesso(origin: string, chiave: string): string {
  // La pagina /entra (logo, istruzioni per installare l'app, pulsante "Entra"), non la route
  // /api/nuovo/entra che apre la sessione: quella resta valida per i link già mandati.
  return `${origin}/entra?k=${chiave}`;
}
/** Ritorna l'id dell'utente attivo a cui appartiene la chiave, o null. */
export async function verificaChiaveAccesso(k: string): Promise<string | null> {
  // I vecchi codici invito a 6 lettere non sono mai chiavi valide: troppo corti per un link.
  if (!k || k.length < LUNGHEZZA_MINIMA_CHIAVE) return null;
  const [u] = await getDb().select({ id: utenti.id, attivo: utenti.attivo }).from(utenti).where(eq(utenti.codice_invito, k));
  return u && u.attivo ? u.id : null;
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
    return { id: u.id, username: u.username ?? '', nome: u.nome, ruolo: u.ruolo, proprietarioId: u.proprietario_id,
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

  return { id: u.id, username: u.username ?? '', nome: u.nome, ruolo: u.ruolo, proprietarioId: u.proprietario_id,
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
