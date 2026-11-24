/**
 * Notifiche push (24/11/2026). Un dispositivo si iscrive dal pulsante "🔔 Notifiche" nell'app; il server manda un avviso breve con web-push.
 * Nell'avviso non ci sono mai dati personali degli ospiti: solo conteggi e il tipo di cosa da fare ("2 arrivi oggi"), perché il testo passa
 * dai servizi di Google/Apple prima di arrivare al telefono. I dettagli si vedono aprendo l'app.
 */
import * as webpush from 'web-push';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from './db';
import { pushAvvisi, pushImpostazioni, pushSottoscrizioni, utenti } from './db/schema';

export type AvvisoPush = { titolo: string; testo: string; url?: string; tag?: string };

let configurato = false;
let chiavePubblica: string | null = null;

/** Le chiavi VAPID stanno nelle variabili d'ambiente (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) oppure, se mancano, nella tabella push_impostazioni. */
async function configura(): Promise<boolean> {
  if (configurato) return true;
  let pub = process.env.VAPID_PUBLIC_KEY?.trim(), priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!pub || !priv) {
    const righe = await getDb().select().from(pushImpostazioni);
    pub = righe.find((r) => r.chiave === 'vapid_pubblica')?.valore; priv = righe.find((r) => r.chiave === 'vapid_privata')?.valore;
  }
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || 'https://salzillo-hospitality.vercel.app', pub, priv);
  chiavePubblica = pub; configurato = true;
  return true;
}

export async function chiavePubblicaPush(): Promise<string | null> { return (await configura()) ? chiavePubblica : null; }

/** Manda l'avviso a tutti i dispositivi iscritti dei ruoli indicati (di default Titolare e Operatore). Ritorna quanti sono arrivati. */
export async function inviaPush(avviso: AvvisoPush, ruoli: string[] = ['Titolare', 'Collaboratore']): Promise<{ inviati: number; rimossi: number }> {
  if (!(await configura())) return { inviati: 0, rimossi: 0 };
  const db = getDb();
  const righe = await db.select({ id: pushSottoscrizioni.id, endpoint: pushSottoscrizioni.endpoint, p256dh: pushSottoscrizioni.p256dh, auth: pushSottoscrizioni.auth })
    .from(pushSottoscrizioni).innerJoin(utenti, eq(utenti.id, pushSottoscrizioni.utente_id))
    .where(and(eq(utenti.attivo, true), inArray(utenti.ruolo, ruoli as ('Titolare' | 'Collaboratore')[])));
  const corpo = JSON.stringify({ titolo: avviso.titolo, testo: avviso.testo, url: avviso.url ?? '/nuovo', tag: avviso.tag });
  let inviati = 0; const morti: string[] = [];
  await Promise.all(righe.map(async (r) => {
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, corpo, { TTL: 60 * 60 * 12 });
      inviati++;
    } catch (e) {
      const stato = (e as { statusCode?: number }).statusCode;
      if (stato === 404 || stato === 410) morti.push(r.id); // il dispositivo non esiste più: si toglie
      else console.error('[push] invio non riuscito:', stato ?? (e instanceof Error ? e.message : e));
    }
  }));
  if (morti.length) await db.delete(pushSottoscrizioni).where(inArray(pushSottoscrizioni.id, morti));
  if (inviati) await db.update(pushSottoscrizioni).set({ ultimo_invio: new Date() }).where(inArray(pushSottoscrizioni.id, righe.map((r) => r.id).filter((id) => !morti.includes(id))));
  return { inviati, rimossi: morti.length };
}

/** Manda l'avviso una sola volta per chiave (per esempio una sovrapposizione di calendario): se è già stato mandato non fa niente. */
export async function avvisaUnaVolta(chiave: string, avviso: AvvisoPush, ruoli?: string[]): Promise<boolean> {
  const db = getDb();
  const nuovo = await db.insert(pushAvvisi).values({ chiave }).onConflictDoNothing().returning({ chiave: pushAvvisi.chiave });
  if (!nuovo.length) return false;
  await inviaPush(avviso, ruoli);
  return true;
}
