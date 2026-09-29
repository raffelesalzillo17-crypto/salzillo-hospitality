import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { generaRendicontoPdf } from '@/lib/db/rendicontoPdf';
import { registraDocumentoProprietario } from '@/lib/documenti';
import { rendicontoProprietarioDb } from '@/lib/db/queries';

// PDF del rendiconto mensile proprietario — pronto da inviare (WhatsApp/email).
// Il disegno vero e proprio del PDF vive in src/lib/db/rendicontoPdf.ts (estratto il
// 29/09/2026 per essere riusabile anche dal cron mensile automatico via email, che non ha una
// sessione HTTP a cui appoggiarsi) — questa route resta solo autenticazione + salvataggio Drive.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;
  const proprietarioParam = req.nextUrl.searchParams.get('proprietario');
  const anno = Number(req.nextUrl.searchParams.get('anno'));
  const mese = Number(req.nextUrl.searchParams.get('mese'));
  if (!proprietarioParam || !anno || !mese) return NextResponse.json({ ok: false, error: 'Parametri mancanti' }, { status: 400 });

  if (proprietarioParam === 'tutti' && sess.ruolo !== 'Titolare') return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
  if (sess.ruolo === 'Proprietario' && sess.proprietarioId !== proprietarioParam) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
  const proprietarioId = proprietarioParam === 'tutti' ? null : proprietarioParam;
  const scarica = req.nextUrl.searchParams.get('download') === '1';
  const immobileId = req.nextUrl.searchParams.get('immobile') || undefined;
  const alloggioId = req.nextUrl.searchParams.get('alloggio') || undefined;
  const ambito = alloggioId ? { alloggioId } : immobileId ? { immobileId } : undefined;

  // serve solo per sapere se esiste (404 pulito) e per il nome del proprietario nei log — il
  // disegno del PDF rifà comunque la query completa dentro generaRendicontoPdf
  const esiste = await rendicontoProprietarioDb(proprietarioId, anno, mese, ambito);
  if (!esiste) return NextResponse.json({ ok: false, error: 'Non trovato' }, { status: 404 });

  const risultato = await generaRendicontoPdf(proprietarioId, anno, mese, ambito);
  if (!risultato) return NextResponse.json({ ok: false, error: 'Non trovato' }, { status: 404 });
  const { bytes, nome: nomeFile } = risultato;

  // Salvato su Drive (cartella del proprietario) solo quando c'è un proprietario vero — la
  // vista "tutti i proprietari insieme" non ha un unico destinatario a cui appartenga il file.
  if (proprietarioId) {
    registraDocumentoProprietario({
      proprietarioId, nomeProprietario: esiste.proprietario, nomeFile, contenuto: Buffer.from(bytes), tipo: 'Rendiconto',
    }).catch((e) => console.error('[rendiconto/pdf] salvataggio su Drive fallito (non bloccante):', e instanceof Error ? e.message : e));
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      // "inline" apre il PDF navigando la scheda — dentro l'app installata come PWA
      // (standalone, senza barra del browser) questo intrappola chi la usa senza un modo per
      // tornare indietro (bug reale segnalato da Raffaele il 14/09/2026). Con ?download=1 (i
      // link cliccabili nell'app lo passano sempre) forziamo invece il download: il file si
      // salva e l'app resta aperta dov'era.
      'Content-Disposition': `${scarica ? 'attachment' : 'inline'}; filename="${nomeFile}"`,
    },
  });
}
