import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { alloggi, ospiti, prenotazioni } from '@/lib/db/schema';
import * as M from '@/lib/db/mutations';
import { ErroreDate, ErroreSovrapposizione } from '@/lib/db/disponibilita';
import { ALLOGGI_SEED } from '@/lib/db/importDaSheets';

// Scritture sul B&B riservate a Duet, l'assistente di Raffaele (13/11/2026). SOLO dopo l'approvazione di
// Raffaele nella chat (Duet mostra il riepilogo esatto e aspetta il tasto Conferma: questa rotta non decide
// nulla da sola). Usa le stesse funzioni del nuovo gestionale (src/lib/db/mutations.ts): controllo delle date
// occupate, transazione sul database, evento Calendar, riga sul foglio. Serve la chiave DUET_LETTURA_KEY
// nell'intestazione x-duet-key (la stessa della lettura riservata). Azioni:
//   trova     → elenco delle prenotazioni (id interno compreso) filtrabili per stanza, ospite, data
//   crea      → nuova prenotazione
//   aggiorna  → cambia date e/o stanza di una prenotazione
//   cancella  → cancella (con o senza penale)

export const dynamic = 'force-dynamic';

function chiaveValida(req: NextRequest): boolean {
  const attesa = process.env.DUET_LETTURA_KEY || '';
  const data = req.headers.get('x-duet-key') || '';
  if (attesa.length < 32 || data.length !== attesa.length) return false;
  return timingSafeEqual(Buffer.from(data), Buffer.from(attesa));
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const nomeDaFoglio = (stanza: string) => ALLOGGI_SEED.find((a) => a.foglio.toLowerCase() === String(stanza).trim().toLowerCase())?.nome;
const foglioDaNome = (nome: string) => ALLOGGI_SEED.find((a) => a.nome === nome)?.foglio ?? nome;

async function alloggioIdPerStanza(stanza: string): Promise<string | null> {
  const nome = nomeDaFoglio(stanza);
  if (!nome) return null;
  const [al] = await getDb().select({ id: alloggi.id }).from(alloggi).where(eq(alloggi.nome, nome));
  return al?.id ?? null;
}

export async function POST(req: NextRequest) {
  if (!chiaveValida(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  let body: { azione?: string; dati?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }
  const { azione, dati = {} } = body;

  try {
    if (azione === 'trova') {
      const righe = await getDb().select({
        id: prenotazioni.id, checkin: prenotazioni.checkin, checkout: prenotazioni.checkout, stato: prenotazioni.stato, canale: prenotazioni.canale,
        alloggio: alloggi.nome, nome: ospiti.nome, cognome: ospiti.cognome,
      }).from(prenotazioni)
        .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
        .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id));
      const stanza = dati.stanza ? nomeDaFoglio(String(dati.stanza)) : null;
      const ospite = dati.ospite ? String(dati.ospite).toLowerCase() : null;
      const da = ISO.test(String(dati.da || '')) ? String(dati.da) : null;
      const trovate = righe
        .filter((r) => (!stanza || r.alloggio === stanza) && (!ospite || `${r.nome} ${r.cognome}`.toLowerCase().includes(ospite)) && (!da || String(r.checkout) >= da))
        .sort((a, b) => String(a.checkin).localeCompare(String(b.checkin)))
        .slice(0, 20)
        .map((r) => ({ id: r.id, ospite: `${r.nome} ${r.cognome}`.trim(), stanza: foglioDaNome(r.alloggio), checkin: String(r.checkin), checkout: String(r.checkout), stato: r.stato, canale: r.canale }));
      return NextResponse.json({ ok: true, prenotazioni: trovate });
    }

    if (azione === 'crea') {
      const { stanza, nome, cognome, telefono, checkin, checkout, canale, lordo, numeroOspiti } = dati as Record<string, string | number | undefined>;
      if (!stanza || !nome || !cognome || !ISO.test(String(checkin)) || !ISO.test(String(checkout)) || !canale || lordo === undefined || !Number.isFinite(Number(lordo))) {
        return NextResponse.json({ ok: false, error: 'Dati mancanti o non validi (stanza, nome, cognome, date AAAA-MM-GG, canale, importo lordo)' }, { status: 400 });
      }
      if (!['Airbnb', 'Booking', 'Diretto', 'No Tax'].includes(String(canale))) return NextResponse.json({ ok: false, error: 'Canale non valido (Airbnb, Booking, Diretto, No Tax)' }, { status: 400 });
      const alloggioId = await alloggioIdPerStanza(String(stanza));
      if (!alloggioId) return NextResponse.json({ ok: false, error: `Stanza sconosciuta: ${stanza}` }, { status: 400 });
      const r = await M.creaPrenotazione({
        alloggioId, ospiteNome: String(nome).trim(), ospiteCognome: String(cognome).trim(), ospiteTelefono: telefono ? String(telefono).trim() : undefined,
        checkin: String(checkin), checkout: String(checkout), numeroOspiti: numeroOspiti ? Number(numeroOspiti) : undefined, canale: String(canale), lordo: Number(lordo),
      });
      return NextResponse.json({ ok: true, prenotazione: { id: r.id, stato: r.stato } });
    }

    if (azione === 'aggiorna') {
      const { id, checkin, checkout, stanza } = dati as Record<string, string | undefined>;
      if (!id) return NextResponse.json({ ok: false, error: 'Manca la prenotazione' }, { status: 400 });
      const mod: Record<string, unknown> = {};
      if (checkin) { if (!ISO.test(checkin)) return NextResponse.json({ ok: false, error: 'Data di arrivo non valida' }, { status: 400 }); mod.checkin = checkin; }
      if (checkout) { if (!ISO.test(checkout)) return NextResponse.json({ ok: false, error: 'Data di partenza non valida' }, { status: 400 }); mod.checkout = checkout; }
      if (stanza) { const al = await alloggioIdPerStanza(stanza); if (!al) return NextResponse.json({ ok: false, error: `Stanza sconosciuta: ${stanza}` }, { status: 400 }); mod.alloggioId = al; }
      if (!Object.keys(mod).length) return NextResponse.json({ ok: false, error: 'Nessuna modifica richiesta' }, { status: 400 });
      const r = await M.aggiornaPrenotazione(id, mod);
      return NextResponse.json({ ok: true, prenotazione: { id: (r as { id?: string })?.id ?? id } });
    }

    if (azione === 'cancella') {
      const { id, conPenale, importoPenale } = dati as { id?: string; conPenale?: boolean; importoPenale?: number };
      if (!id) return NextResponse.json({ ok: false, error: 'Manca la prenotazione' }, { status: 400 });
      await M.cancellaPrenotazione(id, !!conPenale, importoPenale !== undefined ? Number(importoPenale) : undefined);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Azione sconosciuta' }, { status: 400 });
  } catch (err) {
    if (err instanceof ErroreSovrapposizione) return NextResponse.json({ ok: false, error: err.message, sovrapposizione: true }, { status: 409 });
    if (err instanceof ErroreDate) return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    console.error('[duet/azione] ERRORE:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Errore' }, { status: 500 });
  }
}
