import { NextRequest, NextResponse } from 'next/server';
import {
  leggiPrenotazioniDb, leggiOspitiDb, leggiAnagraficaDb, leggiAlloggiDb,
  leggiSpeseDb, leggiScadenzeDb, riepilogoMeseDb, cosaMancaDb, leggiCategorieSpesaDb,
  leggiPreventiviDb, leggiEventiLocaliDb, leggiPrezziPeriodoDb, leggiPulizieDb, leggiDocumentiDb,
  richiesteNuoveDb,
} from '@/lib/db/queries';
import { leggiUtentiDb, leggiPermessiDb } from '@/lib/db/mutations';
import { richiediSessione, alloggiVisibili } from '@/lib/db/auth';
import { getStruttura } from '@/lib/strutture';
import { toWaNumber } from '@/lib/pulizie';
import { schedineDaInviareAlloggiati } from '@/lib/alloggiatiInvio';

/** "Il Tulipano" → struttura "Tulipano", "Stanza Rosa" → "Rosa", per il resto match esatto. */
function strutturaPerAlloggio(alloggioNome: string) {
  const esatto = getStruttura(alloggioNome);
  if (esatto) return esatto;
  return ['Tulipano', 'Rosa', 'Piano Terra', 'Primo Piano', 'Secondo Piano']
    .map((n) => getStruttura(n)).find((s) => s && alloggioNome.includes(s.nome));
}

/** Messaggio/numero già pronti per il pulsante "invia su WhatsApp" della dashboard — stesso
 *  testo esatto del promemoria automatico di check-in (cron/checkin-reminder), per non avere
 *  due copie diverse in giro. */
function datiWhatsappCheckin(alloggioNome: string, telefono: string) {
  const s = strutturaPerAlloggio(alloggioNome);
  const numero = telefono ? toWaNumber(telefono) : null;
  if (!s?.checkinGuideUrl || !s.guideMessageText || !numero) return { waCheckinNumero: null, waCheckinMessaggio: null };
  return { waCheckinNumero: numero, waCheckinMessaggio: `${s.guideMessageText}\n${s.emoji ?? ''} ${s.checkinGuideUrl}` };
}

// Tutti i dati per la nuova interfaccia (/nuovo), letti dal database, filtrati per quello
// che l'utente ha il diritto di vedere (titolare = tutto; collaboratore/proprietario = i
// loro immobili). Vedi src/lib/db/auth.ts.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;

  try {
    const oggi = new Date();
    const oggiISO = oggi.toISOString().slice(0, 10);
    const [tuttePren, ospiti, anagrafica, alloggi, spese, scadenze, riepilogoMese, cosaManca, categorieSpesa, preventivi, pulizie, documenti, richieste] = await Promise.all([
      leggiPrenotazioniDb(),
      leggiOspitiDb(),
      leggiAnagraficaDb(),
      leggiAlloggiDb(),
      leggiSpeseDb(),
      leggiScadenzeDb(),
      riepilogoMeseDb(oggi.getFullYear(), oggi.getMonth() + 1),
      cosaMancaDb(oggiISO),
      leggiCategorieSpesaDb(),
      leggiPreventiviDb(),
      leggiPulizieDb(),
      leggiDocumentiDb(),
      richiesteNuoveDb(),
    ]);
    const [eventi, prezzi, tuttiUtenti] = await Promise.all([leggiEventiLocaliDb(), leggiPrezziPeriodoDb(), leggiUtentiDb()]);
    const operatoriPulizie = tuttiUtenti.filter((u) => u.ruolo === 'Pulizie' && u.attivo).map((u) => ({ id: u.id, nome: u.nome }));

    // Filtro di visibilità
    const visibili = await alloggiVisibili(sess);
    const anagFiltr = sess.immobiliVisibili === 'tutti'
      ? anagrafica
      : anagrafica.map((p) => ({ ...p, immobili: p.immobili.filter((im) => (sess.immobiliVisibili as string[]).includes(im.id)) })).filter((p) => p.immobili.length > 0);
    const prenotazioni = visibili === 'tutti' ? tuttePren : tuttePren.filter((p) => {
      const a = alloggi.find((x) => x.nome === p.alloggio);
      return a && visibili.has(a.id);
    });
    const alloggiFiltr = visibili === 'tutti' ? alloggi : alloggi.filter((a) => visibili.has(a.id));
    const pulizieFiltr = visibili === 'tutti' ? pulizie : pulizie.filter((p) => visibili.has(p.alloggioId));

    // Chi non vede il finanziario riceve i numeri azzerati
    const pren = (sess.vedeFinanziario ? prenotazioni : prenotazioni.map((p) => ({
      ...p, lordo: 0, commissione: 0, cedolare: 0, costoPulizia: 0, feeGestione: 0, utile: 0, nettoProprietario: 0,
    }))).map((p) => ({ ...p, ...datiWhatsappCheckin(p.alloggio, p.telefono) }));

    return NextResponse.json({
      ok: true,
      oggi: oggiISO,
      sessione: { nome: sess.nome, ruolo: sess.ruolo, vedeFinanziario: sess.vedeFinanziario, puoModificare: sess.immobiliModificabili === 'tutti' || sess.immobiliModificabili.length > 0 },
      prenotazioni: pren,
      ospiti,
      anagrafica: anagFiltr,
      alloggi: alloggiFiltr,
      spese: sess.vedeFinanziario ? spese : [],
      scadenze,
      cosaManca,
      pulizie: pulizieFiltr,
      operatoriPulizie,
      utenti: sess.ruolo === 'Titolare' ? tuttiUtenti : [],
      permessi: sess.ruolo === 'Titolare' ? await leggiPermessiDb() : [],
      schedineAlloggiati: sess.ruolo === 'Titolare' ? await schedineDaInviareAlloggiati() : [],
      categorieSpesa,
      preventivi: sess.vedeFinanziario ? preventivi : [],
      richieste: sess.vedeFinanziario ? richieste : [],
      documenti: sess.vedeFinanziario ? documenti : [],
      eventi,
      prezzi,
      riepilogoMese: sess.vedeFinanziario ? riepilogoMese.map((r) => ({
        immobile: r.immobile, proprietario: r.proprietario,
        prenotazioni: r.prenotazioni, lordo: Number(r.lordo),
        utile: Number(r.utile), nettoProprietario: Number(r.nettoProprietario),
      })) : [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[nuovo/dati] ERRORE:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
