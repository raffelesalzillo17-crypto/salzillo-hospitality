import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { richiediSessione } from '@/lib/db/auth';
import { getDb } from '@/lib/db';
import { documenti } from '@/lib/db/schema';
import { prenotazioneVisibile, puoScrivereDocumenti } from '@/lib/db/accessoPrenotazione';
import { scaricaDocumentoDrive } from '@/lib/documenti';
import { cercaComuni, cercaStato, cercaTipoDocumento, CODICE_ITALIA } from '@/lib/alloggiatiLookup';

// Legge un documento già caricato (foto) con l'OCR e restituisce i dati per PRECOMPILARE una
// schedina Alloggiati. Non scrive nulla: Raffaele vede e corregge i campi, poi la schedina si
// crea con /api/nuovo/schedina (stesso principio di /api/checkin-ocr: l'OCR è un aiuto, mai una
// scrittura diretta di un dato legalmente rilevante).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TIPI_OK = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const err = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
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
  const mime = (d.mime || '').toLowerCase();
  if (!TIPI_OK.has(mime)) return err('Per ora leggo solo le foto (JPG, PNG, WebP, HEIC), non i PDF: compila i campi a mano.');

  let letto: { ok?: boolean; dati?: Record<string, string>; error?: string };
  try {
    const contenuto = await scaricaDocumentoDrive(d.drive_file_id);
    const r = await fetch(`${req.nextUrl.origin}/api/checkin-ocr`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: contenuto.toString('base64'), mediaType: mime }),
    });
    letto = await r.json();
    if (!r.ok || !letto.ok || !letto.dati) return err(letto.error || 'Lettura non riuscita — compila i dati a mano.', 502);
  } catch (e) {
    return err(`Lettura non riuscita: ${e instanceof Error ? e.message : String(e)}`, 502);
  }

  const dati = letto.dati;
  const stato = cercaStato(dati.statoNascita || '');
  const cittadinanza = cercaStato(dati.cittadinanza || '');
  const tipoDoc = cercaTipoDocumento(dati.tipoDocumento || '');
  const nataInItalia = stato?.codice === CODICE_ITALIA;
  const comuni = nataInItalia ? cercaComuni(dati.luogoNascita || '') : [];
  return NextResponse.json({
    ok: true,
    dati: {
      ...dati,
      statoNascita: stato?.nome ?? dati.statoNascita ?? '',
      cittadinanza: cittadinanza?.nome ?? dati.cittadinanza ?? '',
      tipoDocumento: tipoDoc?.nome ?? '',
    },
    // più comuni con lo stesso nome (province diverse): si sceglie a mano
    comuniCandidati: comuni.map((c) => ({ codice: c.codice, nome: c.nome, provincia: c.provincia })),
  });
}
