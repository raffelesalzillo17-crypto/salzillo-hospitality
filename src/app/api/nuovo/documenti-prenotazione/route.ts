import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { alloggiVisibili, richiediSessione, type Sessione } from '@/lib/db/auth';
import { getDb } from '@/lib/db';
import { alloggi, documenti, ospiti, prenotazioni } from '@/lib/db/schema';
import { eliminaDocumentoDrive, registraDocumento } from '@/lib/documenti';

// Documenti d'identità degli ospiti, caricati da Raffaele/collaboratori dalla scheda della
// prenotazione (richiesta del 12/10/2026: i documenti non li compila più l'ospite sul sito, li
// raccoglie Raffaele e li allega qui). Stesso storage dei contratti/ricevute: Drive (cartella
// dell'ospite) + una riga nella tabella `documenti` legata alla prenotazione.
//
//   GET    ?prenotazione=<id>   → elenco dei documenti d'identità di quella prenotazione
//   POST   multipart: prenotazione=<id>, file=<uno o più file>   → carica
//   DELETE ?id=<documentoId>    → toglie dall'elenco e sposta il file nel cestino di Drive

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TIPO = 'Documento identità' as const;
const MAX_BYTES = 4 * 1024 * 1024; // sotto il limite di ~4,5 MB del corpo di una funzione Vercel
const MAX_FILE = 8;
const MIME_OK = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i;

const err = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const puoScrivere = (s: Sessione) => s.ruolo === 'Titolare' || s.ruolo === 'Collaboratore';

/** La prenotazione, solo se la sessione può vederla. */
async function prenotazioneVisibile(id: string, sess: Sessione) {
  const db = getDb();
  const [p] = await db.select({
    id: prenotazioni.id, ospiteId: prenotazioni.ospite_id, alloggioId: prenotazioni.alloggio_id,
    nome: ospiti.nome, cognome: ospiti.cognome,
  }).from(prenotazioni)
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(eq(prenotazioni.id, id));
  if (!p) return null;
  const vis = await alloggiVisibili(sess);
  if (vis !== 'tutti' && !vis.has(p.alloggioId)) return null;
  return p;
}

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const id = req.nextUrl.searchParams.get('prenotazione') || '';
  if (!id) return err('Manca la prenotazione');
  const p = await prenotazioneVisibile(id, check.sessione);
  if (!p) return err('Prenotazione non trovata', 404);
  const righe = await getDb().select({
    id: documenti.id, nome: documenti.nome, driveUrl: documenti.drive_url, mime: documenti.mime, caricatoIl: documenti.caricato_il,
  }).from(documenti)
    .where(and(eq(documenti.prenotazione_id, id), eq(documenti.tipo, TIPO)))
    .orderBy(desc(documenti.caricato_il));
  return NextResponse.json({ ok: true, documenti: righe.map((d) => ({ ...d, caricatoIl: new Date(d.caricatoIl).toISOString() })) });
}

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (!puoScrivere(check.sessione)) return err('Il tuo ruolo non può caricare documenti', 403);

  let form: FormData;
  try { form = await req.formData(); } catch { return err('Richiesta non valida'); }
  const id = String(form.get('prenotazione') || '');
  const files = form.getAll('file').filter((f): f is File => typeof f !== 'string' && f.size > 0);
  if (!id) return err('Manca la prenotazione');
  if (!files.length) return err('Nessun file selezionato');
  if (files.length > MAX_FILE) return err(`Massimo ${MAX_FILE} file per volta`);
  for (const f of files) {
    if (!MIME_OK.test(f.type)) return err(`"${f.name}": formato non supportato (foto o PDF)`);
    if (f.size > MAX_BYTES) return err(`"${f.name}": troppo grande (max 4 MB)`);
  }

  const p = await prenotazioneVisibile(id, check.sessione);
  if (!p) return err('Prenotazione non trovata', 404);
  const nomeOspite = `${p.nome} ${p.cognome}`.trim();

  const salvati: string[] = [];
  try {
    for (const f of files) {
      const estensione = f.type === 'application/pdf' ? 'pdf' : f.type.split('/')[1].replace('jpeg', 'jpg');
      const nomeFile = `Documento identità — ${nomeOspite} — ${new Date().toISOString().slice(0, 10)}-${salvati.length + 1}.${estensione}`;
      await registraDocumento({
        ospiteId: p.ospiteId, nomeOspite, nomeFile, contenuto: Buffer.from(await f.arrayBuffer()),
        tipo: TIPO, prenotazioneId: id, mimeType: f.type,
      });
      salvati.push(nomeFile);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[documenti-prenotazione] ERRORE upload:', msg);
    return NextResponse.json({ ok: false, error: `Caricati ${salvati.length} su ${files.length}. Errore: ${msg}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, caricati: salvati.length });
}

export async function DELETE(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (!puoScrivere(check.sessione)) return err('Il tuo ruolo non può eliminare documenti', 403);
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return err('Manca il documento');
  const db = getDb();
  const [d] = await db.select().from(documenti).where(and(eq(documenti.id, id), eq(documenti.tipo, TIPO)));
  if (!d || !d.prenotazione_id) return err('Documento non trovato', 404);
  const p = await prenotazioneVisibile(d.prenotazione_id, check.sessione);
  if (!p) return err('Documento non trovato', 404);
  // Prima il file su Drive (nel cestino, recuperabile per 30 giorni), poi la riga: se Drive
  // fallisce il documento resta in elenco invece di sparire dall'app ma restare su Drive.
  if (d.drive_file_id) await eliminaDocumentoDrive(d.drive_file_id);
  await db.delete(documenti).where(eq(documenti.id, id));
  return NextResponse.json({ ok: true });
}
