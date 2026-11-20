import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { richiediSessione } from '@/lib/db/auth';
import { getDb } from '@/lib/db';
import { documenti } from '@/lib/db/schema';
import { prenotazioneVisibile, puoScrivereDocumenti } from '@/lib/db/accessoPrenotazione';
import { scaricaDocumentoDrive } from '@/lib/documenti';
import { leggiDocumento, TIPI_OCR_SUPPORTATI, normalizzaTipoOcr, type DatiDocumento } from '@/lib/ocrDocumento';
import { cercaComuni, cercaStato, cercaTipoDocumento, CODICE_ITALIA } from '@/lib/alloggiatiLookup';

// Legge un documento già caricato (foto) con l'OCR e restituisce i dati per PRECOMPILARE una
// schedina Alloggiati. Non scrive nulla: Raffaele vede e corregge i campi, poi la schedina si
// crea con /api/nuovo/schedina (stesso principio di /api/checkin-ocr: l'OCR è un aiuto, mai una
// scrittura diretta di un dato legalmente rilevante).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const LIMITE_FUNZIONE_MS = 58_000; // 2 s di margine sotto maxDuration
const TIMEOUT_DRIVE_MS = 12_000;

const err = (error: string, status = 400, codice?: string) => NextResponse.json({ ok: false, error, ...(codice ? { codice } : {}) }, { status });

export async function POST(req: NextRequest) {
  const inizio = Date.now();
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (!puoScrivereDocumenti(check.sessione)) return err('Il tuo ruolo non può creare schedine', 403);

  let body: { documentoId?: string };
  try { body = await req.json(); } catch { return err('Richiesta non valida'); }
  if (!body.documentoId) return err('Manca il documento');

  const [d] = await getDb().select().from(documenti)
    .where(and(eq(documenti.id, body.documentoId), eq(documenti.tipo, 'Documento identità')));
  if (!d || !d.prenotazione_id || !d.drive_file_id) return err('Documento non trovato', 404);
  const p = await prenotazioneVisibile(d.prenotazione_id, check.sessione);
  if (!p) return err('Documento non trovato', 404);
  const mime = normalizzaTipoOcr(d.mime || '');
  if (!TIPI_OCR_SUPPORTATI.has(mime)) return err('Formato non leggibile (servono foto JPG, PNG, WebP, HEIC oppure PDF): compila i campi a mano.');

  let dati: DatiDocumento;
  try {
    const contenuto = await scaricaDocumentoDrive(d.drive_file_id, TIMEOUT_DRIVE_MS);
    const budgetMs = LIMITE_FUNZIONE_MS - (Date.now() - inizio);
    if (budgetMs < 8000) return err('Lettura non riuscita: il servizio di lettura è occupato — riprova tra un attimo, oppure compila i dati a mano.', 502, 'servizio_occupato');
    const esito = await leggiDocumento(contenuto.toString('base64'), mime, { budgetMs });
    if (!esito.ok) return err(esito.error || 'Lettura non riuscita — compila i dati a mano.', 502, esito.codice);
    dati = esito.dati;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const download = /drive|scaduto|aborted|timeout/i.test(msg);
    console.error('[schedina-da-documento]', download ? 'download Drive fallito' : 'lettura fallita', { elapsedMs: Date.now() - inizio });
    return err(
      download
        ? 'Lettura non riuscita: non sono riuscito a scaricare il documento — riprova, oppure compila i dati a mano.'
        : 'Lettura non riuscita — compila i dati a mano.',
      502,
      download ? 'documento_non_scaricato' : 'errore_interno',
    );
  }

  const stato = cercaStato(dati.statoNascita || '');
  const cittadinanza = cercaStato(dati.cittadinanza || '');
  const tipoDoc = cercaTipoDocumento(dati.tipoDocumento || '');
  const nataInItalia = stato?.codice === CODICE_ITALIA;
  // Toglie una sigla "(CS)" rimasta nel nome e la usa per scegliere tra comuni omonimi: è una
  // corrispondenza esatta sul nome + provincia, non un'ipotesi (vedi alloggiatiLookup.ts).
  const pulisci = (testo: string) => {
    const m = testo.match(/\(([A-Za-z]{2})\)\s*$/);
    return { nome: testo.replace(/\s*\([^)]*\)\s*$/, '').trim(), prov: (m?.[1] || '').toUpperCase() };
  };
  const nascita = pulisci(dati.luogoNascita || '');
  const prov = (dati.provinciaNascita || nascita.prov || '').toUpperCase();
  let comuni = nataInItalia ? cercaComuni(nascita.nome) : [];
  if (comuni.length > 1 && prov) {
    const stessaProv = comuni.filter((c) => c.provincia.toUpperCase() === prov);
    if (stessaProv.length) comuni = stessaProv;
  }
  const rilascio = pulisci(dati.luogoRilascioDocumento || '').nome;
  return NextResponse.json({
    ok: true,
    dati: {
      ...dati,
      luogoNascita: nascita.nome,
      luogoRilascioDocumento: rilascio,
      statoNascita: stato?.nome ?? dati.statoNascita ?? '',
      cittadinanza: cittadinanza?.nome ?? dati.cittadinanza ?? '',
      tipoDocumento: tipoDoc?.nome ?? '',
    },
    // più comuni con lo stesso nome (province diverse): si sceglie a mano
    comuniCandidati: comuni.map((c) => ({ codice: c.codice, nome: c.nome, provincia: c.provincia })),
  });
}
