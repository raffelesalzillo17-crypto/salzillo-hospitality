import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { richiediSessione } from '@/lib/db/auth';
import { getDb } from '@/lib/db';
import { documenti, scadenzeStorico } from '@/lib/db/schema';
import { salvaRicevutaScadenza } from '@/lib/db/scadenzeGestione';
import { scaricaDocumentoDrive } from '@/lib/documenti';
import { registra } from '@/lib/db/registro';

// Ricevuta di una scadenza fatta (F24, versamento, comunicazione…), punto 13 delle richieste, 23/11/2026.
//   POST multipart: scadenza=<id>, file=<immagine o PDF>   → allega (o sostituisce) la ricevuta all'ULTIMO completamento
//   GET  ?scadenza=<id>                                    → il file dell'ultimo completamento
// Solo Titolare e collaboratori con accesso ai dati finanziari.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const MIME_OK = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i;
const err = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;
  if (!(sess.ruolo === 'Titolare' || (sess.ruolo === 'Collaboratore' && sess.vedeFinanziario))) return err('Non hai il permesso di allegare ricevute', 403);
  let form: FormData;
  try { form = await req.formData(); } catch { return err('Richiesta non valida'); }
  const id = String(form.get('scadenza') || '');
  const file = form.get('file');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return err('Manca la scadenza');
  if (!(file instanceof File)) return err('Manca il file');
  if (file.size === 0) return err('Il file è vuoto');
  if (file.size > MAX_BYTES) return err('File troppo grande (massimo 4 MB): riduci la foto o scattala con meno qualità.');
  if (!MIME_OK.test(file.type)) return err('Formato non supportato: usa una foto (JPG, PNG, HEIC) o un PDF.');
  try {
    const r = await salvaRicevutaScadenza(id, { nome: file.name || 'ricevuta', mime: file.type, contenuto: Buffer.from(await file.arrayBuffer()) });
    await registra(sess, 'allega-ricevuta-scadenza', 'scadenza', id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 400);
  }
}

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (!check.sessione.vedeFinanziario) return err('Non hai il permesso di vedere le ricevute', 403);
  const id = req.nextUrl.searchParams.get('scadenza') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return err('Scadenza non valida');
  const [r] = await getDb().select({ file: documenti.drive_file_id, mime: documenti.mime }).from(scadenzeStorico)
    .innerJoin(documenti, eq(documenti.id, scadenzeStorico.ricevuta_documento_id)).where(eq(scadenzeStorico.scadenza_id, id)).orderBy(desc(scadenzeStorico.fatta_il), desc(scadenzeStorico.creato_il)).limit(1);
  if (!r?.file) return err('Nessuna ricevuta allegata', 404);
  try {
    const contenuto = await scaricaDocumentoDrive(r.file);
    return new NextResponse(new Uint8Array(contenuto), { headers: { 'Content-Type': r.mime || 'application/octet-stream', 'Content-Disposition': 'inline', 'Cache-Control': 'private, max-age=3600' } });
  } catch (e) {
    return err(`File non leggibile da Drive: ${e instanceof Error ? e.message : String(e)}`, 502);
  }
}
