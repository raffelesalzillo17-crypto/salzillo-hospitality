import { NextRequest, NextResponse } from 'next/server';
import { sheets_v4 } from 'googleapis';
import { and, eq, ne } from 'drizzle-orm';
import {
  getSheetsClient,
  colLetter,
  sheetExists as sheetExistsShared,
  readAllRows as readAllRowsShared,
  fileIdForTab,
} from '@/lib/sheets';
import {
  SCHEDINE_SHEET_NAME,
  SCHEDINE_NUM_COLS,
  COL_DATA_ARRIVO,
  COL_NOTTI,
  COL_STANZA,
  COL_COGNOME,
  COL_NOME,
  COL_DATA_NASCITA,
  COL_LUOGO_NASCITA,
  COL_CITTADINANZA,
  COL_TIPO_DOCUMENTO,
  COL_NUMERO_DOCUMENTO,
  COL_RAPPORTO,
  COL_STATO,
  COL_PRENOTAZIONE_ROW,
  COL_SESSO,
  COL_TIPO_ALLOGGIATO_CODICE,
  COL_COMUNE_NASCITA_CODICE,
  COL_PROVINCIA_NASCITA,
  COL_STATO_NASCITA_CODICE,
  COL_CITTADINANZA_CODICE,
  COL_TIPO_DOCUMENTO_CODICE,
  COL_LUOGO_RILASCIO_DOCUMENTO,
  STATO_DA_INVIARE,
  STATO_INVIATO_MANUALMENTE,
  type Schedina,
} from '@/lib/schedine';
import { getDb } from '@/lib/db/index';
import { prenotazioni, alloggi, schedine, ospiti as ospitiTabella } from '@/lib/db/schema';
import { alertOspiteBloccato } from '@/lib/cronAlert';
import { inviaTelegram } from '@/lib/telegramDigest';
import { registraDocumento } from '@/lib/documenti';

// Scheda "SCHEDINE" sul vecchio foglio Google — GET e PATCH restano qui sotto per chi le usa
// ancora da lì (nessun chiamante trovato nel codice attuale al 20/09/2026, ma non tolte per
// prudenza). La POST invece — quella che il check-in pubblico usa davvero — è stata riscritta
// per scrivere sul database: il tab "DATABASE" del vecchio foglio (da cui la POST leggeva le
// prenotazioni per validare la data di arrivo dell'ospite) non esiste più nel file a cui questo
// codice risulta collegato — spostato altrove durante la migrazione a Postgres di metà settembre
// senza che le variabili SPREADSHEET_ID_* del nuovo file fossero mai impostate. Risultato: OGNI
// check-in online falliva con "non troviamo una prenotazione", indipendentemente dalla data
// inserita — scoperto il 20/09/2026 con la prenotazione vera di Marcello Vaghi. Il database è
// comunque la fonte vera oggi (le prenotazioni create dall'app ci sono sempre, sul foglio no),
// quindi la POST ora legge/scrive lì direttamente invece di dipendere da un foglio orfano.
//
// IMPORTANTE: questa route prepara e salva SOLO i dati delle schedine. Non chiama e non deve
// mai chiamare API esterne reali di Alloggiati Web o Sinfonia Turismo Smart — decisione
// esplicita di Raffaele (notte del 07/09/2026). L'invio resta manuale finché non verrà
// attivato, un altro giorno, con un test supervisionato.

function rowToSchedina(row: number, values: unknown[]): Schedina {
  const v = (i: number) => String(values[i] ?? '');
  return {
    row,
    dataArrivo: v(COL_DATA_ARRIVO),
    notti: v(COL_NOTTI),
    stanza: v(COL_STANZA),
    cognome: v(COL_COGNOME),
    nome: v(COL_NOME),
    dataNascita: v(COL_DATA_NASCITA),
    luogoNascita: v(COL_LUOGO_NASCITA),
    cittadinanza: v(COL_CITTADINANZA),
    tipoDocumento: v(COL_TIPO_DOCUMENTO),
    numeroDocumento: v(COL_NUMERO_DOCUMENTO),
    rapporto: v(COL_RAPPORTO),
    stato: v(COL_STATO) || STATO_DA_INVIARE,
    prenotazioneRow: v(COL_PRENOTAZIONE_ROW),
    sesso: v(COL_SESSO),
    tipoAlloggiatoCodice: v(COL_TIPO_ALLOGGIATO_CODICE),
    comuneNascitaCodice: v(COL_COMUNE_NASCITA_CODICE),
    provinciaNascita: v(COL_PROVINCIA_NASCITA),
    statoNascitaCodice: v(COL_STATO_NASCITA_CODICE),
    cittadinanzaCodice: v(COL_CITTADINANZA_CODICE),
    tipoDocumentoCodice: v(COL_TIPO_DOCUMENTO_CODICE),
    luogoRilascioDocumento: v(COL_LUOGO_RILASCIO_DOCUMENTO),
  };
}

function readAllRows(sheets: sheets_v4.Sheets) {
  return readAllRowsShared(sheets, SCHEDINE_SHEET_NAME, SCHEDINE_NUM_COLS, 2000);
}

function toISO(dataItaliana: string): string {
  // DD/MM/YYYY -> YYYY-MM-DD, per confronti/ordinamento e filtro per range di date.
  const parts = dataItaliana.split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest) {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);

    // Se la scheda non esiste ancora non c'è nulla da leggere: nessuna schedina è mai stata
    // compilata. Evita di richiedere lo scope di scrittura solo per una GET.
    if (!(await sheetExistsShared(sheets, SCHEDINE_SHEET_NAME))) {
      return NextResponse.json({ ok: true, schedine: [] });
    }

    const prenotazioneRowParam = req.nextUrl.searchParams.get('prenotazioneRow');
    const daParam = req.nextUrl.searchParams.get('da'); // DD/MM/YYYY, incluso
    const aParam = req.nextUrl.searchParams.get('a');   // DD/MM/YYYY, incluso

    const rows = await readAllRows(sheets);
    let schedineLette = rows.map((r) => rowToSchedina(r.row, r.values));

    if (prenotazioneRowParam) {
      schedineLette = schedineLette.filter((s) => s.prenotazioneRow === prenotazioneRowParam);
    }
    if (daParam) {
      const daISO = toISO(daParam);
      schedineLette = schedineLette.filter((s) => toISO(s.dataArrivo) >= daISO);
    }
    if (aParam) {
      const aISO = toISO(aParam);
      schedineLette = schedineLette.filter((s) => toISO(s.dataArrivo) <= aISO);
    }

    return NextResponse.json({ ok: true, schedine: schedineLette });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[schedine] GET ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type OspiteInviato = {
  cognome: unknown; nome: unknown; dataNascita: unknown; luogoNascita: unknown;
  cittadinanza: unknown; tipoDocumento: unknown; numeroDocumento: unknown; rapporto: unknown;
  sesso: unknown; tipoAlloggiatoCodice: unknown; comuneNascitaCodice: unknown; provinciaNascita: unknown;
  statoNascitaCodice: unknown; cittadinanzaCodice: unknown; tipoDocumentoCodice: unknown; luogoRilascioDocumento: unknown;
  // Foto del documento già ridimensionata lato client (stesso JPEG mandato a /api/checkin-ocr,
  // riusato qui) — facoltativa: se l'ospite non ha caricato una foto, il check-in resta valido
  // comunque, semplicemente non c'è nulla da salvare su Drive per lui.
  documentoBase64: unknown; documentoMimeType: unknown;
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const { dataArrivo, stanza, ospiti } = body;
  if (typeof dataArrivo !== 'string' || !dataArrivo.trim() || typeof stanza !== 'string' || !stanza.trim()) {
    return NextResponse.json({ error: 'Campo mancante: dataArrivo o stanza' }, { status: 400 });
  }
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataArrivo)) {
    return NextResponse.json({ error: 'dataArrivo deve essere in formato DD/MM/YYYY' }, { status: 400 });
  }
  if (!Array.isArray(ospiti) || ospiti.length === 0) {
    return NextResponse.json({ error: 'Nessun ospite nel check-in' }, { status: 400 });
  }
  const listaOspiti = ospiti as OspiteInviato[];
  const campiRichiesti: (keyof OspiteInviato)[] = ['cognome', 'nome', 'dataNascita', 'luogoNascita', 'cittadinanza', 'tipoDocumento', 'numeroDocumento', 'rapporto'];
  for (const o of listaOspiti) {
    for (const campo of campiRichiesti) {
      if (typeof o[campo] !== 'string' || !(o[campo] as string).trim()) {
        return NextResponse.json({ error: `Campo mancante: ${campo}` }, { status: 400 });
      }
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(o.dataNascita as string)) {
      return NextResponse.json({ error: 'dataNascita deve essere in formato DD/MM/YYYY' }, { status: 400 });
    }
  }

  const nomeStanza = stanza.trim();
  const checkinISO = toISO(dataArrivo.trim());

  try {
    const db = getDb();

    // "Tulipano" (il nome corto usato da data-stanza nel gate) è sempre contenuto nel nome
    // completo dell'alloggio nel database ("Il Tulipano") — stessa idea già usata altrove
    // (vedi strutturaPerAlloggio in src/lib/strutture.ts, direzione opposta).
    const alloggiAttivi = await db.select({ id: alloggi.id, nome: alloggi.nome }).from(alloggi).where(eq(alloggi.attivo, true));
    const alloggioTrovato = alloggiAttivi.find((a) => a.nome.includes(nomeStanza));

    const candidate = alloggioTrovato
      ? await db.select().from(prenotazioni).where(and(
          eq(prenotazioni.alloggio_id, alloggioTrovato.id),
          eq(prenotazioni.checkin, checkinISO),
          ne(prenotazioni.stato, 'Cancellata'),
        ))
      : [];

    if (candidate.length !== 1) {
      // Gli ospiti restano bloccati senza poter proseguire — avvisa subito Raffaele invece di
      // scoprirlo solo a guaio fatto (vedi wiki/log.md 10/09/2026, Serafina Posillipo).
      const motivo = !alloggioTrovato
        ? `Stanza "${nomeStanza}" non riconosciuta`
        : candidate.length === 0
          ? 'Nessuna prenotazione attiva con questa data di arrivo'
          : 'Più prenotazioni combaciano con questa data — serve una scelta manuale';
      const primo = listaOspiti[0];
      await alertOspiteBloccato({
        stanza: nomeStanza, dataArrivo: dataArrivo.trim(),
        ospite: `${String(primo.nome).trim()} ${String(primo.cognome).trim()}`, motivo,
      });
      return NextResponse.json({ error: 'Non troviamo una prenotazione con questa data di arrivo. Controlla la data o contatta Salzillo Hospitality.' }, { status: 404 });
    }
    const pren = candidate[0];

    // Scadenza invio Alloggiati Web: 6 ore dal check-in per un soggiorno di una notte, 24 ore
    // per soggiorni più lunghi (regola già descritta nello schema, mai applicata finora perché
    // questa route non arrivava a crearne — vedi commento sopra).
    const notti = Math.max(1, Math.round((Date.parse(pren.checkout) - Date.parse(pren.checkin)) / 864e5));
    const scadeIl = new Date(Date.parse(pren.checkin) + (notti <= 1 ? 6 : 24) * 3600e3);

    const righe = await db.insert(schedine).values(listaOspiti.map((o) => ({
      prenotazione_id: pren.id,
      ospite_id: pren.ospite_id,
      cognome: String(o.cognome).trim(),
      nome: String(o.nome).trim(),
      sesso: (o.sesso === 'M' || o.sesso === 'F' ? o.sesso : null) as 'M' | 'F' | null,
      data_nascita: toISO(String(o.dataNascita).trim()) || null,
      luogo_nascita: String(o.luogoNascita).trim(),
      cittadinanza: typeof o.cittadinanza === 'string' ? o.cittadinanza.trim() : null,
      tipo_documento: String(o.tipoDocumento).trim(),
      numero_documento: String(o.numeroDocumento).trim(),
      luogo_rilascio_documento: typeof o.luogoRilascioDocumento === 'string' ? o.luogoRilascioDocumento.trim() || null : null,
      tipo_alloggiato: String(o.rapporto).trim(),
      tipo_alloggiato_codice: typeof o.tipoAlloggiatoCodice === 'string' ? o.tipoAlloggiatoCodice : null,
      comune_nascita_codice: typeof o.comuneNascitaCodice === 'string' ? o.comuneNascitaCodice || null : null,
      provincia_nascita: typeof o.provinciaNascita === 'string' ? o.provinciaNascita || null : null,
      stato_nascita_codice: typeof o.statoNascitaCodice === 'string' ? o.statoNascitaCodice || null : null,
      cittadinanza_codice: typeof o.cittadinanzaCodice === 'string' ? o.cittadinanzaCodice || null : null,
      tipo_documento_codice: typeof o.tipoDocumentoCodice === 'string' ? o.tipoDocumentoCodice || null : null,
      stato: 'Da inviare' as const,
      scade_il: scadeIl,
    }))).returning();

    // Salva su Drive (cartella dell'ospite principale della prenotazione, la stessa già usata
    // per contratti/ricevute — vedi src/lib/documenti.ts) la foto del documento di ogni ospite
    // che ne ha caricata una: era prevista fin dal disegno dello schema (tipo "Documento
    // identità") ma non era mai stata effettivamente collegata qui — il check-in online
    // salvava solo i dati testuali letti dalla foto, non la foto stessa. Scoperto il
    // 22/09/2026 da Raffaele: pensava fosse già così per Marcello Vaghi e Anna Maria Leo.
    // Best-effort: un errore di Drive non deve mai far fallire il check-in già registrato.
    const [ospitePrincipale] = await db.select({ nome: ospitiTabella.nome, cognome: ospitiTabella.cognome }).from(ospitiTabella).where(eq(ospitiTabella.id, pren.ospite_id));
    const nomeCartella = ospitePrincipale ? `${ospitePrincipale.nome} ${ospitePrincipale.cognome}`.trim() : `${listaOspiti[0].nome} ${listaOspiti[0].cognome}`;
    await Promise.all(listaOspiti.map(async (o) => {
      if (typeof o.documentoBase64 !== 'string' || !o.documentoBase64) return;
      try {
        await registraDocumento({
          ospiteId: pren.ospite_id,
          nomeOspite: nomeCartella,
          nomeFile: `Documento identità - ${String(o.cognome).trim()} ${String(o.nome).trim()}.jpg`,
          contenuto: Buffer.from(o.documentoBase64, 'base64'),
          tipo: 'Documento identità',
          prenotazioneId: pren.id,
          mimeType: typeof o.documentoMimeType === 'string' && o.documentoMimeType ? o.documentoMimeType : 'image/jpeg',
        });
      } catch (e) {
        console.error(`[schedine] salvataggio documento su Drive fallito per ${String(o.cognome).trim()} ${String(o.nome).trim()}:`, e);
      }
    }));

    // Avviso a Raffaele per la revisione manuale prima di inviare la scheda WiFi/regole —
    // il flusso scelto esplicitamente il 19/09/2026: primo link solo check-in, poi lui controlla
    // qui i dati e solo dopo manda il secondo link dalla scheda della prenotazione. UN messaggio
    // per prenotazione con tutti gli ospiti (non uno a testa, vedi segnalazione di Raffaele del
    // 20/09/2026 dopo il caso Marcello Vaghi + compagna).
    const elencoOspiti = listaOspiti.map((o) =>
      `${String(o.cognome).trim()} ${String(o.nome).trim()} (${String(o.rapporto).trim()})\n` +
      `Nato/a: ${String(o.dataNascita).trim()} a ${String(o.luogoNascita).trim()}\n` +
      `Documento: ${String(o.tipoDocumento).trim()} n. ${String(o.numeroDocumento).trim()}`,
    ).join('\n\n');
    await inviaTelegram(
      `📋 *Check-in compilato*\n${nomeStanza} — arrivo ${dataArrivo.trim()} (${listaOspiti.length} ospit${listaOspiti.length === 1 ? 'e' : 'i'})\n\n` +
      `${elencoOspiti}\n\n` +
      `Se i dati sono corretti, manda la scheda WiFi/regole dalla prenotazione. Se manca o è sbagliato qualcosa, riscrivi all'ospite o correggi tu.`,
    ).catch((e) => console.error('[schedine] avviso Telegram non inviato:', e));

    return NextResponse.json({ ok: true, schedine: righe });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[schedine] POST ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH: cambia SOLO lo Stato di una schedina esistente (es. "Inviato manualmente" dopo che
// Raffaele ha copiato i dati a mano nel vero Portale Alloggiati Web). Nessuna chiamata a
// sistemi esterni: aggiorna solo la cella Stato sul foglio Google.
//
// NOTA: opera ancora sul vecchio foglio (vedi commento sopra su GET/POST) — nessun chiamante
// trovato nel codice attuale, lasciata invariata per prudenza invece di rimossa alla cieca.
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const { row, stato } = body;
  const rowNum = Number(row);
  if (!Number.isInteger(rowNum) || rowNum < 2) {
    return NextResponse.json({ error: 'row non valido' }, { status: 400 });
  }
  if (stato !== STATO_DA_INVIARE && stato !== STATO_INVIATO_MANUALMENTE) {
    return NextResponse.json({ error: `stato deve essere "${STATO_DA_INVIARE}" o "${STATO_INVIATO_MANUALMENTE}"` }, { status: 400 });
  }

  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);

    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('SCHEDINE'),
      range: `${SCHEDINE_SHEET_NAME}!${colLetter(COL_STATO)}${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[stato]] },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[schedine] PATCH ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
