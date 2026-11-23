import { NextRequest, NextResponse } from 'next/server';
import {
  leggiPrenotazioniDb, leggiOspitiDb, leggiAnagraficaDb, leggiAlloggiDb,
  leggiSpeseDb, leggiScadenzeDb, riepilogoMeseDb, cosaMancaDb, leggiCategorieSpesaDb,
  leggiPreventiviDb, leggiEventiLocaliDb, leggiPrezziPeriodoDb, leggiPulizieDb, leggiDocumentiDb,
  richiesteNuoveDb, leggiTuttiIBlocchiDb, leggiLinkUtiliDb,
} from '@/lib/db/queries';
import { leggiUtentiDb, leggiPermessiDb } from '@/lib/db/mutations';
import { richiediSessione, alloggiVisibili, creaToken, COOKIE, OPZIONI_COOKIE } from '@/lib/db/auth';
import { strutturaPerAlloggio } from '@/lib/strutture';
import { toWaNumber } from '@/lib/pulizie';
import { schedineDaInviareAlloggiati, schedineDaVerificare, inviiFattiAlloggiati } from '@/lib/alloggiatiInvio';
import { attivitaAperte, attivitaChiuse, leggiRegole, riconcilia } from '@/lib/db/regole';
import { leggiRegistro, leggiCestino, svuotaCestinoScaduto } from '@/lib/db/registro';
import { leggiOspitiDiProva } from '@/lib/db/ospitiGestione';
import { avvisiAdempimenti } from '@/lib/adempimenti';

/** Messaggio/numero già pronti per il pulsante "invia su WhatsApp" della dashboard — stesso
 *  testo esatto del promemoria automatico di check-in (cron/checkin-reminder), per non avere
 *  due copie diverse in giro. */
function datiWhatsappCheckin(alloggioNome: string, telefono: string) {
  const s = strutturaPerAlloggio(alloggioNome);
  const numero = telefono ? toWaNumber(telefono) : null;
  if (!s?.infoGuideUrl || !s.guideMessageText || !numero) return { waCheckinNumero: null, waCheckinMessaggio: null };
  return { waCheckinNumero: numero, waCheckinMessaggio: `${s.guideMessageText}\n${s.emoji ?? ''} ${s.infoGuideUrl}` };
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
    const [tuttePren, ospiti, anagrafica, alloggi, spese, scadenze, riepilogoMese, cosaManca, categorieSpesa, preventivi, pulizie, documenti, richieste, tuttiBlocchi] = await Promise.all([
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
      leggiTuttiIBlocchiDb(),
    ]);
    const [eventi, prezzi, tuttiUtenti, linkUtili] = await Promise.all([leggiEventiLocaliDb(), leggiPrezziPeriodoDb(), leggiUtentiDb(), leggiLinkUtiliDb()]);
    // Promemoria e messaggi automatici: solo per chi gestisce (Titolare/Collaboratore). Si riconcilia
    // prima di leggere, così la lista è sempre allineata alle prenotazioni di adesso; se qualcosa va
    // storto la scheda si nasconde ma il resto del gestionale funziona.
    const vedePromemoria = sess.ruolo === 'Titolare' || sess.ruolo === 'Collaboratore';
    const promemoria = vedePromemoria
      ? await (async () => {
          try {
            await riconcilia();
            const [aperte, chiuse, regole] = await Promise.all([attivitaAperte(), attivitaChiuse(), leggiRegole()]);
            return { aperte, chiuse, regole };
          } catch (e) { console.error('[nuovo/dati] promemoria non disponibili:', e instanceof Error ? e.message : e); return undefined; }
        })()
      : undefined;
    // L'addetto pulizie riceve SOLO i dati delle pulizie (punto 5, 23/11/2026): niente ospiti, prenotazioni, documenti, spese.
    const soloPulizie = sess.ruolo === 'Pulizie';
    const titolare = sess.ruolo === 'Titolare';
    if (titolare) await svuotaCestinoScaduto();
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
    const blocchiFiltr = visibili === 'tutti' ? tuttiBlocchi : tuttiBlocchi.filter((b) => visibili.has(b.alloggioId));

    // Chi non vede il finanziario riceve i numeri azzerati
    const pren = (sess.vedeFinanziario ? prenotazioni : prenotazioni.map((p) => ({
      ...p, lordo: 0, commissione: 0, cedolare: 0, costoPulizia: 0, feeGestione: 0, utile: 0, nettoProprietario: 0,
    }))).map((p) => ({ ...p, ...datiWhatsappCheckin(p.alloggio, p.telefono) }));

    const risposta = NextResponse.json({
      ok: true,
      oggi: oggiISO,
      sessione: { nome: sess.nome, ruolo: sess.ruolo, vedeFinanziario: sess.vedeFinanziario, puoModificare: sess.immobiliModificabili === 'tutti' || sess.immobiliModificabili.length > 0 },
      prenotazioni: soloPulizie ? [] : pren,
      ospiti: soloPulizie ? [] : ospiti,
      anagrafica: soloPulizie ? [] : anagFiltr,
      alloggi: alloggiFiltr,
      spese: sess.vedeFinanziario && !soloPulizie ? spese : [],
      scadenze: soloPulizie ? [] : scadenze,
      cosaManca: soloPulizie ? { schedineDaInviare: [], scadenzeVicine: [], pulizieDaFare: [], pagamentiInSospeso: [] } : cosaManca,
      pulizie: pulizieFiltr,
      operatoriPulizie,
      utenti: sess.ruolo === 'Titolare' ? tuttiUtenti : [],
      permessi: sess.ruolo === 'Titolare' ? await leggiPermessiDb() : [],
      schedineAlloggiati: sess.ruolo === 'Titolare' ? await schedineDaInviareAlloggiati() : [],
      schedineDaVerificare: sess.ruolo === 'Titolare' ? await schedineDaVerificare() : [],
      inviiAlloggiati: sess.ruolo === 'Titolare' ? await inviiFattiAlloggiati() : [],
      categorieSpesa: soloPulizie ? [] : categorieSpesa,
      preventivi: sess.vedeFinanziario && !soloPulizie ? preventivi : [],
      richieste: sess.vedeFinanziario && !soloPulizie ? richieste : [],
      documenti: sess.vedeFinanziario && !soloPulizie ? documenti : [],
      eventi: soloPulizie ? [] : eventi,
      prezzi: soloPulizie || !titolare ? [] : prezzi,
      linkUtili: soloPulizie ? [] : linkUtili,
      promemoria: soloPulizie ? undefined : promemoria,
      blocchi: soloPulizie ? [] : blocchiFiltr,
      ospitiDiProva: titolare ? await leggiOspitiDiProva() : [],
      // Schedine ancora da fare, in ritardo o a meno di 24 ore dal termine (punto 6): per la Dashboard. Se il calcolo fallisce non blocca il resto.
      adempimentiAvvisi: titolare ? await avvisiAdempimenti(oggiISO).catch((e) => { console.error('[nuovo/dati] avvisi adempimenti:', e instanceof Error ? e.message : e); return []; }) : [],
      registro: titolare ? await leggiRegistro(150) : [],
      cestino: titolare ? await leggiCestino() : [],
      riepilogoMese: sess.vedeFinanziario ? riepilogoMese.map((r) => ({
        immobile: r.immobile, proprietario: r.proprietario,
        prenotazioni: r.prenotazioni, lordo: Number(r.lordo),
        utile: Number(r.utile), nettoProprietario: Number(r.nettoProprietario),
      })) : [],
    });
    // Sessione rinnovata a ogni apertura: chi usa l'app con regolarità non rimette mai le credenziali.
    risposta.cookies.set(COOKIE, creaToken(sess.id), OPZIONI_COOKIE);
    return risposta;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[nuovo/dati] ERRORE:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
