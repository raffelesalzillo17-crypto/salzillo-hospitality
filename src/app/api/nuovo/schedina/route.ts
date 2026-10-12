import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { richiediSessione } from '@/lib/db/auth';
import { getDb } from '@/lib/db';
import { schedine } from '@/lib/db/schema';
import { prenotazioneVisibile, puoScrivereDocumenti } from '@/lib/db/accessoPrenotazione';
import { cercaComuni, cercaStato, cercaTipoDocumento, CODICE_ITALIA, TIPI_ALLOGGIATO_UI } from '@/lib/alloggiatiLookup';

// Crea una schedina Alloggiati a partire dai dati controllati da Raffaele nella scheda della
// prenotazione (di solito precompilati dall'OCR, vedi schedina-da-documento). I codici ufficiali
// si ricavano QUI dai nomi, con corrispondenza esatta sulle tabelle reali: non ci si fida dei
// codici mandati dal browser. Stato "Da inviare", come quelle create dal vecchio check-in.

export const dynamic = 'force-dynamic';

const err = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
function toISO(it: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(it);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(iso + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (!puoScrivereDocumenti(check.sessione)) return err('Il tuo ruolo non può creare schedine', 403);

  let body: { prenotazioneId?: string; ospite?: Record<string, unknown> };
  try { body = await req.json(); } catch { return err('Richiesta non valida'); }
  const o = body.ospite ?? {};
  if (!body.prenotazioneId) return err('Manca la prenotazione');
  const p = await prenotazioneVisibile(body.prenotazioneId, check.sessione);
  if (!p) return err('Prenotazione non trovata', 404);

  const cognome = s(o.cognome), nome = s(o.nome), numero = s(o.numeroDocumento);
  if (!cognome || !nome) return err('Servono cognome e nome');
  if (!numero) return err('Manca il numero del documento');
  const sesso = s(o.sesso).toUpperCase();
  if (sesso !== 'M' && sesso !== 'F') return err('Il sesso deve essere M o F');
  const dataNascita = toISO(s(o.dataNascita));
  if (!dataNascita) return err('Data di nascita non valida (GG/MM/AAAA)');
  const statoNascita = cercaStato(s(o.statoNascita));
  if (!statoNascita) return err('Stato di nascita non riconosciuto: scegli un nome dalla lista ufficiale');
  const cittadinanza = cercaStato(s(o.cittadinanza));
  if (!cittadinanza) return err('Cittadinanza non riconosciuta: scegli un nome dalla lista ufficiale');
  const tipoDoc = cercaTipoDocumento(s(o.tipoDocumento));
  if (!tipoDoc) return err("Tipo di documento non valido (Carta d'identità, Passaporto o Patente)");
  const tipoAll = TIPI_ALLOGGIATO_UI.find((t) => t.codice === s(o.tipoAlloggiatoCodice));
  if (!tipoAll) return err('Scegli il tipo di ospite (singolo, capofamiglia, familiare...)');

  // Comune e provincia di nascita: obbligatori solo per chi è nato in Italia
  let comuneCodice: string | null = null, provincia: string | null = null;
  const luogoNascita = s(o.luogoNascita);
  if (statoNascita.codice === CODICE_ITALIA) {
    const candidati = cercaComuni(luogoNascita);
    const scelto = s(o.comuneNascitaCodice)
      ? candidati.find((c) => c.codice === s(o.comuneNascitaCodice))
      : candidati.length === 1 ? candidati[0] : undefined;
    if (!scelto) {
      return err(candidati.length === 0
        ? `Comune di nascita "${luogoNascita}" non trovato nelle tabelle ufficiali`
        : `Più comuni si chiamano "${luogoNascita}": scegli la provincia`);
    }
    comuneCodice = scelto.codice; provincia = scelto.provincia;
  }

  const db = getDb();
  const doppia = await db.select({ id: schedine.id }).from(schedine).where(and(
    eq(schedine.prenotazione_id, p.id), eq(schedine.cognome, cognome), eq(schedine.nome, nome),
  ));
  if (doppia.length) return err(`Esiste già una schedina per ${nome} ${cognome} su questa prenotazione`, 409);

  // Scadenza invio: 6 ore dal check-in per una notte, 24 ore per soggiorni più lunghi (come il check-in online)
  const notti = Math.max(1, Math.round((Date.parse(p.checkout) - Date.parse(p.checkin)) / 864e5));
  const scadeIl = new Date(Date.parse(p.checkin) + (notti <= 1 ? 6 : 24) * 3600e3);

  const [riga] = await db.insert(schedine).values({
    prenotazione_id: p.id, ospite_id: p.ospiteId, cognome, nome, sesso: sesso as 'M' | 'F',
    data_nascita: dataNascita, luogo_nascita: luogoNascita || null,
    comune_nascita_codice: comuneCodice, provincia_nascita: provincia,
    stato_nascita: statoNascita.nome, stato_nascita_codice: statoNascita.codice,
    cittadinanza: cittadinanza.nome, cittadinanza_codice: cittadinanza.codice,
    tipo_documento: tipoDoc.nome, tipo_documento_codice: tipoDoc.codice, numero_documento: numero,
    luogo_rilascio_documento: s(o.luogoRilascioDocumento) || null,
    tipo_alloggiato: tipoAll.nome, tipo_alloggiato_codice: tipoAll.codice,
    stato: 'Da inviare', scade_il: scadeIl,
  }).returning({ id: schedine.id });
  return NextResponse.json({ ok: true, id: riga.id });
}
