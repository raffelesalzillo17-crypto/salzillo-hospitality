// Posta del B&B (02/10/2026). Motivo: Raffaele si è perso un evento di Airbnb a cui aveva chiesto di
// partecipare — l'invito è arrivato nella casella salzillohospitality@gmail.com e nessuno lo ha
// segnalato. Ora il sistema legge TUTTE le email in arrivo (non solo le conferme di prenotazione),
// le riassume in italiano e avvisa su Telegram; per gli inviti chiede "vuoi partecipare?" con tre
// tasti e risponde lui al posto di Raffaele (Google Calendar), annotando l'esito.
//
// Le conferme di prenotazione Airbnb/Booking restano gestite da eseguiSyncEmailPrenotazioni
// (telegramDigest.ts): qui vengono solo registrate come "gestite", senza un secondo avviso.
//
// Classificazione con Gemini (stesso motore del resto del progetto). Se la classificazione
// fallisce l'email NON si perde: viene avvisata comunque, con oggetto e mittente.

import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';
import { eq, inArray, and, desc, sql } from 'drizzle-orm';
import { getDb } from './db/index';
import { postaEmail, oauthToken } from './db/schema';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-3.6-flash';
const SERVIZIO_CALENDARIO = 'google_calendar_bnb';
const TZ = 'Europe/Rome';

// ── Gmail ──────────────────────────────────────────────────────────────────────

function gmailClient() {
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: client });
}

type Part = { mimeType?: string; filename?: string; body?: { data?: string; attachmentId?: string }; parts?: Part[] };

function raccogliParti(part: Part | undefined, out: { testo: string[]; html: string[]; ics: Part[] }) {
  if (!part) return;
  const tipo = part.mimeType ?? '';
  if (tipo === 'text/plain' && part.body?.data) out.testo.push(Buffer.from(part.body.data, 'base64url').toString('utf8'));
  else if (tipo === 'text/html' && part.body?.data) out.html.push(Buffer.from(part.body.data, 'base64url').toString('utf8'));
  else if (tipo === 'text/calendar' || /\.ics$/i.test(part.filename ?? '')) out.ics.push(part);
  for (const p of part.parts ?? []) raccogliParti(p, out);
}

function htmlInTesto(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

// ── Inviti (iCalendar) ─────────────────────────────────────────────────────────

export type DatiInvito = {
  uid?: string; summary?: string; start?: string; end?: string; allDay?: boolean;
  organizer?: string; location?: string; url?: string; metodo?: string;
};

function dataIcs(valore: string | undefined): { iso?: string; allDay: boolean } {
  if (!valore) return { allDay: false };
  const m = valore.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return { allDay: false };
  if (!m[4]) return { iso: `${m[1]}-${m[2]}-${m[3]}`, allDay: true };
  return { iso: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ? 'Z' : ''}`, allDay: false };
}

export function leggiIcs(testo: string): DatiInvito {
  const righe = testo.replace(/\r?\n[ \t]/g, '').split(/\r?\n/); // unisce le righe "ripiegate"
  const val = (chiave: string): { valore: string; params: string } | undefined => {
    const r = righe.find((l) => l.toUpperCase().startsWith(chiave + ':') || l.toUpperCase().startsWith(chiave + ';'));
    if (!r) return undefined;
    const i = r.indexOf(':');
    return { valore: r.slice(i + 1).trim(), params: r.slice(0, i) };
  };
  const inizio = val('DTSTART');
  const fine = val('DTEND');
  const org = val('ORGANIZER');
  const s = dataIcs(inizio?.valore);
  const e = dataIcs(fine?.valore);
  const unesc = (t?: string) => t?.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  return {
    uid: val('UID')?.valore,
    summary: unesc(val('SUMMARY')?.valore),
    start: s.iso, end: e.iso, allDay: s.allDay,
    organizer: org ? (org.params.match(/CN=([^;:]+)/i)?.[1]?.replace(/"/g, '') ?? org.valore.replace(/^mailto:/i, '')) : undefined,
    location: unesc(val('LOCATION')?.valore),
    url: val('URL')?.valore,
    metodo: val('METHOD')?.valore,
  };
}

// ── Classificazione ────────────────────────────────────────────────────────────

type Classificazione = {
  categoria: string; importanza: 'alta' | 'media' | 'bassa'; riassunto: string; azione_suggerita: string;
};

const PROMPT = `Sei la segreteria di Raffaele Salzillo, che gestisce un piccolo B&B ("Il Tulipano", affitti brevi su Airbnb e Booking.com, a Marcianise/Caserta). Ti passo una email arrivata nella casella del B&B. Decidi se Raffaele deve saperlo e riassumila in italiano.

Rispondi SOLO con JSON: {"categoria": "...", "importanza": "alta|media|bassa", "riassunto": "...", "azione_suggerita": "..."}

categoria: invito (inviti a eventi/riunioni/webinar), prenotazione (prenotazioni, modifiche, cancellazioni), ospite (messaggi di ospiti), piattaforma (comunicazioni Airbnb/Booking: regole, recensioni, richieste, eventi per host, verifiche), pagamento (pagamenti, fatture, payout, tasse), adempimento (Questura, Alloggiati, comune, tassa di soggiorno, CIN, scadenze di legge), promozione (newsletter, offerte, pubblicità), altro.
importanza: "alta" se richiede una sua azione/decisione o ha una scadenza (inviti, richieste di ospiti, scadenze, problemi di pagamento, adempimenti); "media" se è utile saperlo ma non urgente (es. recensione ricevuta, payout in arrivo); "bassa" per promozioni, newsletter, notifiche automatiche irrilevanti.
riassunto: massimo 2 frasi brevi, chiare, che dicano COSA è e PERCHÉ conta per Raffaele, scritte in modo semplice (non copiare testo tecnico, link o numeri di telefono). Se c'è una data/ora o una scadenza, scrivila.
azione_suggerita: una frase (es. "Rispondere entro venerdì", "Nessuna azione", "Decidere se partecipare"); vuota se nessuna.`;

async function classifica(mittente: string, oggetto: string, corpo: string, invito?: DatiInvito): Promise<Classificazione> {
  const contenuto = [
    `Mittente: ${mittente}`, `Oggetto: ${oggetto}`,
    invito ? `INVITO CALENDARIO: ${JSON.stringify(invito)}` : '',
    `Testo:\n${corpo.slice(0, 3500)}`,
  ].filter(Boolean).join('\n');
  const res = await genai.models.generateContent({
    model: MODEL,
    contents: `${PROMPT}\n\n---\n${contenuto}`,
    config: { responseMimeType: 'application/json', temperature: 0.2 },
  });
  const j = JSON.parse(res.text ?? '{}');
  const importanza = ['alta', 'media', 'bassa'].includes(j.importanza) ? j.importanza : 'media';
  return {
    categoria: typeof j.categoria === 'string' ? j.categoria : 'altro',
    importanza,
    riassunto: typeof j.riassunto === 'string' && j.riassunto ? j.riassunto : oggetto,
    azione_suggerita: typeof j.azione_suggerita === 'string' ? j.azione_suggerita : '',
  };
}

// ── Telegram ───────────────────────────────────────────────────────────────────

const esc = (t: string) => t.replace(/[_*`\[]/g, (c) => `\\${c}`);

async function inviaConTasti(testo: string, tasti: { text: string; callback_data: string }[][]): Promise<void> {
  const chatId = process.env.ALLOWED_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;
  const manda = (parseMode?: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: testo, reply_markup: { inline_keyboard: tasti }, ...(parseMode ? { parse_mode: parseMode } : {}) }),
  });
  const res = await manda('Markdown');
  if (!res.ok) await manda();
}

function quando(d: DatiInvito): string {
  if (!d.start) return '';
  const fmt = (iso: string, soloData: boolean) => {
    const dt = soloData ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
    const data = dt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: soloData ? 'UTC' : TZ });
    return soloData ? data : `${data}, ${dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: TZ })}`;
  };
  const inizio = fmt(d.start, !!d.allDay);
  if (!d.end || d.allDay) return inizio;
  return `${inizio}–${new Date(d.end).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: TZ })}`;
}

function testoAvviso(riga: { id: string; mittente: string | null; oggetto: string | null; riassunto: string | null; azione_suggerita: string | null; categoria: string | null; dati: unknown }) {
  const invito = (riga.dati as { ics?: DatiInvito } | null)?.ics;
  const nome = (riga.mittente ?? '').replace(/<.*>/, '').replace(/"/g, '').trim() || riga.mittente || 'mittente sconosciuto';
  if (invito) {
    const righe = [
      `📅 *Invito:* ${esc(invito.summary ?? riga.oggetto ?? '(senza titolo)')}`,
      quando(invito) ? `🗓 ${esc(quando(invito))}` : '',
      invito.organizer ? `👤 Da: ${esc(invito.organizer)}` : `👤 Da: ${esc(nome)}`,
      invito.location ? `📍 ${esc(invito.location)}` : '',
      '',
      esc(riga.riassunto ?? ''),
      '',
      '*Vuoi partecipare?*',
    ].filter((r, i, a) => r !== '' || (a[i - 1] !== '' && i !== 0));
    return righe.join('\n');
  }
  return [
    `📬 *${esc(riga.oggetto ?? '(senza oggetto)')}*`,
    `Da: ${esc(nome)}`,
    '',
    esc(riga.riassunto ?? ''),
    riga.azione_suggerita ? `\n👉 ${esc(riga.azione_suggerita)}` : '',
  ].join('\n');
}

function tastiPer(id: string, invito: boolean) {
  if (invito) {
    return [
      [{ text: '✅ Partecipo', callback_data: `posta:${id}:si` }, { text: '❌ No', callback_data: `posta:${id}:no` }, { text: '🤔 Forse', callback_data: `posta:${id}:forse` }],
      [{ text: '🔕 Ignora', callback_data: `posta:${id}:ignora` }],
    ];
  }
  return [[{ text: '👀 Visto', callback_data: `posta:${id}:visto` }, { text: '⏰ Ricordamelo', callback_data: `posta:${id}:dopo` }]];
}

// ── Scansione ──────────────────────────────────────────────────────────────────

// Email già gestite da altri flussi (conferme di prenotazione): registrate, non riavvisate.
const GIA_GESTITE = /(automated@airbnb\.com|noreply@booking\.com)/i;
const OGGETTI_PRENOTAZIONE = /(prenotazione confermata|hai una nuova prenotazione)/i;
const MAX_AVVISI_PER_ESECUZIONE = 8; // oltre, le email restano "da gestire" e compaiono nel riepilogo del mattino

export async function scansionaPosta(opts: { dryRun?: boolean; maxEmail?: number } = {}): Promise<{ nuove: number; avvisate: number; dettagli: string[] }> {
  const dryRun = !!opts.dryRun;
  const gmail = gmailClient();
  const db = getDb();
  const lista = await gmail.users.messages.list({ userId: 'me', q: 'in:inbox newer_than:3d', maxResults: opts.maxEmail ?? 40 });
  const ids = (lista.data.messages ?? []).map((m) => m.id!).filter(Boolean);
  if (!ids.length) return { nuove: 0, avvisate: 0, dettagli: [] };

  const giaViste = new Set((await db.select({ id: postaEmail.message_id }).from(postaEmail).where(inArray(postaEmail.message_id, ids))).map((r) => r.id));
  const daFare = ids.filter((id) => !giaViste.has(id));
  const dettagli: string[] = [];
  let avvisate = 0;
  // Primissima esecuzione: la tabella è vuota e la casella ha già giorni di posta. Per non
  // sommergere Raffaele, avviso solo quella delle ultime 24 ore; il resto lo registro e basta.
  const [{ n: righeTotali }] = await db.select({ n: sql<number>`count(*)::int` }).from(postaEmail);
  const primaEsecuzione = righeTotali === 0;
  const limiteVecchia = Date.now() - 24 * 60 * 60 * 1000;

  for (const id of daFare) {
    const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const h = (n: string) => full.data.payload?.headers?.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value ?? '';
    const mittente = h('From'), oggetto = h('Subject');
    const ricevuta = h('Date') ? new Date(h('Date')) : new Date();

    // Conferme di prenotazione: già gestite dal flusso dedicato.
    if (GIA_GESTITE.test(mittente) && OGGETTI_PRENOTAZIONE.test(oggetto)) {
      if (!dryRun) await db.insert(postaEmail).values({ message_id: id, thread_id: full.data.threadId, mittente, oggetto, ricevuta_il: ricevuta, categoria: 'prenotazione', importanza: 'bassa', riassunto: 'Conferma di prenotazione (gestita dal flusso prenotazioni)', stato: 'gestita' }).onConflictDoNothing();
      dettagli.push(`(prenotazione già gestita) ${oggetto}`);
      continue;
    }

    if (primaEsecuzione && ricevuta.getTime() < limiteVecchia) {
      if (!dryRun) await db.insert(postaEmail).values({ message_id: id, thread_id: full.data.threadId, mittente, oggetto, ricevuta_il: ricevuta, categoria: 'altro', importanza: 'bassa', riassunto: 'Email precedente all'attivazione, non riassunta', stato: 'ignorata' }).onConflictDoNothing();
      dettagli.push(`(precedente all'attivazione) ${oggetto}`);
      continue;
    }

    const parti = { testo: [] as string[], html: [] as string[], ics: [] as Part[] };
    raccogliParti(full.data.payload as Part, parti);
    const corpo = parti.testo.join('\n').trim() || htmlInTesto(parti.html.join('\n'));

    let invito: DatiInvito | undefined;
    for (const p of parti.ics) {
      try {
        let dati = p.body?.data;
        if (!dati && p.body?.attachmentId) dati = (await gmail.users.messages.attachments.get({ userId: 'me', messageId: id, id: p.body.attachmentId })).data.data ?? undefined;
        if (dati) { const i = leggiIcs(Buffer.from(dati, 'base64url').toString('utf8')); if (i.uid || i.summary) { invito = i; break; } }
      } catch (err) { console.error('[posta] lettura ics fallita:', err instanceof Error ? err.message : err); }
    }

    let c: Classificazione;
    try {
      c = await classifica(mittente, oggetto, corpo, invito);
    } catch (err) {
      console.error('[posta] classificazione fallita, avviso comunque:', err instanceof Error ? err.message : err);
      c = { categoria: invito ? 'invito' : 'altro', importanza: 'media', riassunto: `Non sono riuscito a riassumerla. Oggetto: ${oggetto}`, azione_suggerita: '' };
    }
    if (invito) { c.categoria = 'invito'; c.importanza = 'alta'; }

    const avvisare = c.importanza !== 'bassa';
    const inviaOra = avvisare && avvisate < MAX_AVVISI_PER_ESECUZIONE;
    dettagli.push(`${avvisare ? '🔔' : '·'} [${c.categoria}/${c.importanza}] ${oggetto} — ${c.riassunto}`);
    if (dryRun) continue;

    const [riga] = await db.insert(postaEmail).values({
      message_id: id, thread_id: full.data.threadId, mittente, oggetto, ricevuta_il: ricevuta,
      categoria: c.categoria, importanza: c.importanza, riassunto: c.riassunto, azione_suggerita: c.azione_suggerita,
      stato: avvisare ? 'notificata' : 'ignorata', dati: invito ? { ics: invito } : null,
    }).onConflictDoNothing().returning();
    if (riga && inviaOra) {
      await inviaConTasti(testoAvviso(riga), tastiPer(riga.id, !!invito));
      avvisate++;
    }
  }
  return { nuove: daFare.length, avvisate, dettagli };
}

// ── Risposte ai tasti di Telegram ──────────────────────────────────────────────

async function calendarioUtente() {
  const [t] = await getDb().select().from(oauthToken).where(eq(oauthToken.servizio, SERVIZIO_CALENDARIO)).limit(1);
  if (!t) return null;
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: t.refresh_token });
  return google.calendar({ version: 'v3', auth: client });
}

const ESITO: Record<string, string> = { si: 'accepted', no: 'declined', forse: 'tentative' };

export async function rispondiAlTasto(id: string, azione: string): Promise<string> {
  const db = getDb();
  const [riga] = await db.select().from(postaEmail).where(eq(postaEmail.id, id)).limit(1);
  if (!riga) return 'Non trovo più questa email 🤔';

  if (azione === 'ignora') { await db.update(postaEmail).set({ stato: 'ignorata', aggiornato_il: new Date() }).where(eq(postaEmail.id, id)); return '🔕 Ok, la ignoro.'; }
  if (azione === 'visto') { await db.update(postaEmail).set({ stato: 'gestita', aggiornato_il: new Date() }).where(eq(postaEmail.id, id)); return '👀 Segnata come vista.'; }
  if (azione === 'dopo') { await db.update(postaEmail).set({ stato: 'notificata', aggiornato_il: new Date() }).where(eq(postaEmail.id, id)); return '⏰ Te la ripropongo nel riepilogo di domani mattina.'; }

  if (!(azione in ESITO)) return 'Tasto non riconosciuto 🤔';
  const invito = (riga.dati as { ics?: DatiInvito } | null)?.ics;
  if (!invito) return 'Questa email non è un invito.';
  const cal = await calendarioUtente();
  const nomeEvento = invito.summary ?? riga.oggetto ?? 'evento';
  const parola = azione === 'si' ? 'Parteciperai' : azione === 'no' ? 'Non parteciperai' : 'Parteciperai forse';

  if (!cal) return `Non posso ancora rispondere agli inviti: manca l'autorizzazione al calendario del B&B. Rispondi a mano da Google Calendar (${nomeEvento}).`;

  let trovato = false;
  if (invito.uid) {
    const lista = await cal.events.list({ calendarId: 'primary', iCalUID: invito.uid, maxResults: 1 });
    const ev = lista.data.items?.[0];
    if (ev?.id) {
      const partecipanti = (ev.attendees ?? []).map((a) => (a.self ? { ...a, responseStatus: ESITO[azione] } : a));
      if (partecipanti.some((a) => a.self)) {
        await cal.events.patch({ calendarId: 'primary', eventId: ev.id, sendUpdates: 'all', requestBody: { attendees: partecipanti } });
        trovato = true;
      }
    }
  }
  let nota = '';
  if (!trovato && azione !== 'no' && invito.start) {
    // L'invito non è (ancora) nel calendario: lo annoto io, così non si perde.
    await cal.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: nomeEvento,
        description: `Invito ricevuto via email da ${invito.organizer ?? riga.mittente ?? ''}. ${azione === 'forse' ? 'Partecipazione da confermare.' : ''}`.trim(),
        location: invito.location,
        start: invito.allDay ? { date: invito.start } : { dateTime: invito.start, timeZone: TZ },
        end: invito.allDay ? { date: invito.end ?? invito.start } : { dateTime: invito.end ?? invito.start, timeZone: TZ },
      },
    });
    nota = ' (non era ancora nel calendario: l\'ho aggiunto io)';
  } else if (!trovato) {
    nota = ' (non ho trovato l\'invito nel calendario: se serve, rispondi anche dal link nell\'email)';
  }
  await db.update(postaEmail).set({
    stato: 'gestita', aggiornato_il: new Date(),
    dati: { ics: invito, risposta: azione },
  }).where(eq(postaEmail.id, id));
  return `${azione === 'si' ? '✅' : azione === 'no' ? '❌' : '🤔'} ${parola}: *${esc(nomeEvento)}*${nota}`;
}

// ── Riepilogo per il digest ────────────────────────────────────────────────────

export async function testoPostaInSospeso(): Promise<string | null> {
  const righe = await getDb().select().from(postaEmail)
    .where(and(eq(postaEmail.stato, 'notificata')))
    .orderBy(desc(postaEmail.ricevuta_il)).limit(15);
  if (!righe.length) return null;
  const elenco = righe.map((r) => {
    const invito = (r.dati as { ics?: DatiInvito } | null)?.ics;
    const titolo = invito?.summary ?? r.oggetto ?? '(senza oggetto)';
    return `• ${r.categoria === 'invito' ? '📅 ' : ''}${esc(titolo)}${invito && quando(invito) ? ` — ${esc(quando(invito))}` : ''}${r.azione_suggerita ? ` (${esc(r.azione_suggerita)})` : ''}`;
  });
  return `📬 *Email del B&B ancora da gestire* (${righe.length})\n${elenco.join('\n')}`;
}
