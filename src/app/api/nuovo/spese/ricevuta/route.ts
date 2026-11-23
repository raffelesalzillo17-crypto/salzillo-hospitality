import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { richiediSessione } from '@/lib/db/auth';
import { getDb } from '@/lib/db';
import { documenti, spese } from '@/lib/db/schema';
import { salvaRicevutaSpesa } from '@/lib/db/speseGestione';
import { scaricaDocumentoDrive } from '@/lib/documenti';
import { registra } from '@/lib/db/registro';

// Ricevuta o fattura di una spesa (foto o PDF), punto 12 delle richieste, 23/11/2026.
//   POST multipart: spesa=<id>, file=<immagine o PDF>   → allega (o sostituisce) la ricevuta; il file va su Drive
//   GET  ?spesa=<id>                                    → il file, per vederlo dentro l'app
// Titolare e collaboratori con accesso ai dati finanziari; chi non vede le spese non vede nemmeno le ricevute.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // sotto il limite di ~4,5 MB del corpo di una funzione Vercel
const MIME_OK = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i;
const err = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;
  if (!(sess.ruolo === 'Titolare' || (sess.ruolo === 'Collaboratore' && sess.vedeFinanziario))) return err('Non hai il permesso di allegare ricevute', 403);
  let form: FormData;
  try { form = await req.formData(); } catch { return err('Richiesta non valida'); }
  const spesaId = String(form.get('spesa') || '');
  const file = form.get('file');
  if (!spesaId) return err('Manca la spesa');
  if (!(file instanceof File)) return err('Manca il file');
  if (file.size === 0) return err('Il file è vuoto');
  if (file.size > MAX_BYTES) return err('File troppo grande (massimo 4 MB): riduci la foto o scattala con meno qualità.');
  if (!MIME_OK.test(file.type)) return err('Formato non supportato: usa una foto (JPG, PNG, HEIC) o un PDF.');
  try {
    const r = await salvaRicevutaSpesa(spesaId, { nome: file.name || 'ricevuta', mime: file.type, contenuto: Buffer.from(await file.arrayBuffer()) });
    await registra(sess, 'allega-ricevuta-spesa', 'spesa', spesaId);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 500);
  }
}

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (!check.sessione.vedeFinanziario) return err('Non hai il permesso di vedere le ricevute', 403);
  const spesaId = req.nextUrl.searchParams.get('spesa') || '';
  if (!/^[0-9a-f-]{36}$/i.test(spesaId)) return err('Spesa non valida');
  const [r] = await getDb().select({ file: documenti.drive_file_id, mime: documenti.mime }).from(spese).innerJoin(documenti, eq(documenti.id, spese.scontrino_documento_id)).where(eq(spese.id, spesaId));
  if (!r?.file) return err('Questa spesa non ha una ricevuta', 404);
  try {
    const contenuto = await scaricaDocumentoDrive(r.file);
    return new NextResponse(new Uint8Array(contenuto), { headers: { 'Content-Type': r.mime || 'application/octet-stream', 'Content-Disposition': 'inline', 'Cache-Control': 'private, max-age=3600' } });
  } catch (e) {
    return err(`File non leggibile da Drive: ${e instanceof Error ? e.message : String(e)}`, 502);
  }
}
