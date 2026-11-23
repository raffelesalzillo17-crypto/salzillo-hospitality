import { NextRequest, NextResponse } from 'next/server';
import { anteprimaNoTax, applicaNoTax } from '@/lib/db/migrazioneNoTax';
import { richiediSessione } from '@/lib/db/auth';
import * as M from '@/lib/db/mutations';
import { risolviSchedinaAmbigua } from '@/lib/alloggiatiInvio';
import { aggiornaRegola, creaRegola, eliminaRegola, installaModelliPredefiniti, riconcilia, segnaAttivita } from '@/lib/db/regole';
import { registra, ripristinaDalCestino } from '@/lib/db/registro';
import { controllaCondivisioneDrive } from '@/lib/controlloDrive';
import { proposteConservazione, applicaConservazione } from '@/lib/conservazione';
import { cercaDuplicatiScadenze, chiudiNonApplicabile, completaScadenzaConStorico, riapriScadenza, unisciScadenze } from '@/lib/db/scadenzeGestione';
import { anteprimaEstratto, importaSpese, eliminaSpesa, creaSpesaRicorrente, impostaSpesaRicorrente, eliminaSpesaRicorrente, generaSpeseRicorrenti } from '@/lib/db/speseGestione';
import { segnaInviataAMano, annullaInvioAMano, segnaSinfoniaInviato } from '@/lib/adempimenti';
import { cercaProblemiOspiti, unisciOspiti, invertiNomeCognome, segnaOspiteDiProva } from '@/lib/db/ospitiGestione';

// Route di scrittura del nuovo sistema. Un solo endpoint che smista in base ad `azione`
// (è un gestionale interno, non un'API pubblica — semplice e sufficiente).
// Tutto passa dalla sessione (src/lib/db/auth.ts). Solo il Titolare può scrivere per ora;
// i permessi granulari per collaboratore si affinano quando ci sarà davvero un collaboratore.

export const dynamic = 'force-dynamic';

// Ruoli (punto 5, 23/11/2026): Titolare = tutto. Operatore (ruolo "Collaboratore") = prenotazioni, calendario, ospiti,
// pagamenti, pulizie: NON elimina nulla, NON tocca prezzi né impostazioni (proprietari, immobili, alloggi,
// contratti, regole), NON vede documenti completi né password WiFi (mascherati alla fonte). Addetto pulizie = solo
// "conferma-pulizia" (controllato sotto) e riceve soltanto i dati delle pulizie. "cancella-prenotazione" resta
// all'operatore: è un annullamento di stato (con conferma e nel registro), non un'eliminazione del record.
const SOLO_TITOLARE = new Set([
  'invita-collaboratore', 'link-accesso', 'imposta-permesso', 'attiva-utente', 'elimina-operatore-pulizie',
  'elimina-ospite', 'elimina-proprietario', 'elimina-immobile', 'elimina-alloggio', 'elimina-preventivo', 'elimina-pulizia',
  'cancella-evento', 'cancella-link-utile', 'cancella-prezzo',
  'crea-prezzo', 'crea-proprietario', 'aggiorna-proprietario', 'crea-immobile', 'aggiorna-immobile', 'crea-alloggio', 'aggiorna-alloggio',
  'crea-contratto-gestione', 'aggiorna-contratto-gestione',
  'backfill-preventivi-drive', 'risolvi-schedina-ambigua', 'crea-regola', 'aggiorna-regola', 'elimina-regola',
  'ripristina-dal-cestino', 'controlla-drive', 'proposte-conservazione', 'applica-conservazione',
  // Qualità ospiti (punto 4): ricerca duplicati, unione e segno "di prova" solo Titolare; l'inversione nome/cognome è una correzione che può fare anche l'operatore.
  'cerca-problemi-ospiti', 'unisci-ospiti', 'segna-ospite-prova',
  // Adempimenti (punto 6): segnare a mano "inviata" è del Titolare, che carica il file sul portale
  'segna-alloggiati-inviata', 'annulla-segna-alloggiati', 'segna-sinfonia',
  // Spese (punto 12): import da estratto conto, eliminazione e ricorrenze sono del Titolare
  'cerca-duplicati-scadenze', 'unisci-scadenze',
  // Regime fiscale (punto 3): l'anteprima e lo spostamento dei No Tax sono solo del Titolare
  'anteprima-no-tax', 'applica-no-tax',
  'anteprima-estratto', 'importa-spese', 'elimina-spesa', 'crea-spesa-ricorrente', 'imposta-spesa-ricorrente', 'elimina-spesa-ricorrente', 'genera-spese-ricorrenti',
]);
// Azioni che non cambiano nulla (solo calcoli): non finiscono nel registro.
const NON_REGISTRARE = new Set(['anteprima-importi', 'proposte-conservazione', 'cerca-problemi-ospiti', 'anteprima-estratto', 'cerca-duplicati-scadenze', 'anteprima-no-tax']);

// Dopo queste azioni le prenotazioni cambiano: i promemoria si riallineano (best-effort).
const CAMBIANO_PRENOTAZIONI = new Set(['crea-prenotazione', 'aggiorna-prenotazione', 'cancella-prenotazione', 'accetta-preventivo', 'aggiungi-pagamento', 'applica-no-tax']);

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;

  let body: { azione?: string; id?: string; dati?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }
  const { azione, id, dati = {} } = body;

  const AZIONI_PULIZIE = ['conferma-pulizia', 'annulla-pulizia', 'aggiorna-pulizia'];
  const puoScrivere = sess.ruolo === 'Titolare' || sess.ruolo === 'Collaboratore'
    || (sess.ruolo === 'Pulizie' && !!azione && AZIONI_PULIZIE.includes(azione));
  if (!puoScrivere) {
    return NextResponse.json({ ok: false, error: 'Il tuo ruolo non può modificare i dati' }, { status: 403 });
  }
  if (azione && SOLO_TITOLARE.has(azione) && sess.ruolo !== 'Titolare') {
    return NextResponse.json({ ok: false, error: 'Solo il Titolare può farlo' }, { status: 403 });
  }

  try {
    let r: unknown;
    switch (azione) {
      case 'crea-prenotazione': r = await M.creaPrenotazione({ ...(dati as Parameters<typeof M.creaPrenotazione>[0]), creataDa: sess.id }); break;
      case 'aggiorna-prenotazione': r = await M.aggiornaPrenotazione(id!, dati); break;
      case 'cancella-prenotazione': r = await M.cancellaPrenotazione(id!, !!dati.conPenale, dati.importoPenale as number | undefined); break;
      case 'crea-ospite': r = await M.creaOspite(dati as Parameters<typeof M.creaOspite>[0]); break;
      case 'aggiorna-ospite': r = await M.aggiornaOspite(id!, dati); break;
      case 'elimina-ospite': r = await M.eliminaOspite(id!, sess.id); break;
      case 'aggiungi-pagamento': r = await M.aggiungiPagamento(dati as Parameters<typeof M.aggiungiPagamento>[0]); break;
      case 'crea-proprietario': r = await M.creaProprietario(dati as Parameters<typeof M.creaProprietario>[0]); break;
      case 'aggiorna-proprietario': r = await M.aggiornaProprietario(id!, dati); break;
      case 'elimina-proprietario': r = await M.eliminaProprietario(id!); break;
      case 'crea-immobile': r = await M.creaImmobile(dati as Parameters<typeof M.creaImmobile>[0]); break;
      case 'aggiorna-immobile': r = await M.aggiornaImmobile(id!, dati); break;
      case 'elimina-immobile': r = await M.eliminaImmobile(id!); break;
      case 'crea-alloggio': r = await M.creaAlloggio(dati as Parameters<typeof M.creaAlloggio>[0]); break;
      case 'aggiorna-alloggio': r = await M.aggiornaAlloggio(id!, dati); break;
      case 'elimina-alloggio': r = await M.eliminaAlloggio(id!); break;
      case 'crea-spesa': r = await M.creaSpesa(dati as Parameters<typeof M.creaSpesa>[0]); break;
      case 'crea-scadenza': r = await M.creaScadenza(dati as Parameters<typeof M.creaScadenza>[0]); break;
      case 'seed-scadenze': r = await M.seedScadenzeTipiche(); break;
      case 'crea-preventivo': r = await M.creaPreventivo({ ...(dati as Parameters<typeof M.creaPreventivo>[0]), creatoDa: sess.id }); break;
      case 'stato-preventivo': r = await M.aggiornaStatoPreventivo(id!, String(dati.stato)); break;
      case 'accetta-preventivo': r = await M.accettaPreventivo(id!, sess.id); break;
      case 'nuova-versione-preventivo': r = await M.nuovaVersionePreventivo(id!, sess.id); break;
      case 'elimina-preventivo': r = await M.eliminaPreventivo(id!, sess.id); break;
      case 'ripristina-dal-cestino': r = await ripristinaDalCestino(id!); break;
      case 'controlla-drive': r = await controllaCondivisioneDrive(); break;
      // Conservazione documenti (Garante privacy / DM 7/1/2013): l'elenco è solo lettura; la cancellazione è una prenotazione alla volta.
      case 'proposte-conservazione': r = await proposteConservazione(); break;
      case 'cerca-problemi-ospiti': r = await cercaProblemiOspiti(); break;
      case 'anteprima-estratto': r = await anteprimaEstratto(Array.isArray(dati.righe) ? (dati.righe as Parameters<typeof anteprimaEstratto>[0]) : []); break;
      case 'importa-spese': r = await importaSpese(Array.isArray(dati.righe) ? (dati.righe as Parameters<typeof importaSpese>[0]) : []); break;
      case 'elimina-spesa': r = await eliminaSpesa(id!, sess.id); break;
      case 'crea-spesa-ricorrente': r = await creaSpesaRicorrente(dati as Parameters<typeof creaSpesaRicorrente>[0]); break;
      case 'imposta-spesa-ricorrente': r = await impostaSpesaRicorrente(id!, { attiva: dati.attiva as boolean | undefined, importo: dati.importo !== undefined ? Number(dati.importo) : undefined }); break;
      case 'elimina-spesa-ricorrente': r = await eliminaSpesaRicorrente(id!); break;
      case 'genera-spese-ricorrenti': r = await generaSpeseRicorrenti(new Date().toISOString().slice(0, 10)); break;
      case 'segna-alloggiati-inviata': r = await segnaInviataAMano(id!); break;
      case 'annulla-segna-alloggiati': r = await annullaInvioAMano(id!); break;
      case 'segna-sinfonia': r = await segnaSinfoniaInviato(String(dati.immobileId), Number(dati.anno), Number(dati.mese), dati.inviato === true); break;
      case 'unisci-ospiti': r = await unisciOspiti(id!, Array.isArray(dati.daUnire) ? (dati.daUnire as string[]) : []); break;
      case 'inverti-ospite': r = await invertiNomeCognome(id!); break;
      case 'segna-ospite-prova': r = await segnaOspiteDiProva(id!, dati.valore === true); break;
      case 'applica-conservazione': r = await applicaConservazione(id!); break;
      case 'backfill-preventivi-drive': r = await M.backfillPreventiviSuDrive(); break;
      case 'crea-preventivo-da-richiesta': r = await M.creaPreventivoDaRichiesta(id!, { ...(dati as Parameters<typeof M.creaPreventivoDaRichiesta>[1]), creatoDa: sess.id }); break;
      case 'ignora-richiesta': r = await M.ignoraRichiestaPubblica(id!); break;
      case 'crea-evento': r = await M.creaEventoLocale(dati as Parameters<typeof M.creaEventoLocale>[0]); break;
      case 'aggiorna-evento': r = await M.aggiornaEventoLocale(id!, dati); break;
      case 'cancella-evento': r = await M.cancellaEventoLocale(id!); break;
      case 'crea-link-utile': r = await M.creaLinkUtile(dati as Parameters<typeof M.creaLinkUtile>[0]); break;
      case 'cancella-link-utile': r = await M.cancellaLinkUtile(id!); break;
      case 'crea-prezzo': r = await M.creaPrezzoPeriodo(dati as Parameters<typeof M.creaPrezzoPeriodo>[0]); break;
      case 'cancella-prezzo': r = await M.cancellaPrezzoPeriodo(id!); break;
      case 'crea-contratto-gestione': r = await M.creaContrattoGestione(dati as Parameters<typeof M.creaContrattoGestione>[0]); break;
      case 'aggiorna-contratto-gestione': r = await M.aggiornaContrattoGestione(id!, dati); break;
      case 'completa-scadenza': r = await completaScadenzaConStorico(id!, dati.fattaIl as string | undefined); break;
      case 'non-applicabile-scadenza': r = await chiudiNonApplicabile(id!, String(dati.motivo ?? '')); break;
      case 'riapri-scadenza': r = await riapriScadenza(id!); break;
      case 'cerca-duplicati-scadenze': r = await cercaDuplicatiScadenze(); break;
      case 'unisci-scadenze': r = await unisciScadenze(id!, Array.isArray(dati.daRimuovere) ? (dati.daRimuovere as string[]) : []); break;
      // Pulizie (punto 9): l'addetto pulizie conferma, annulla (solo entro 3 minuti) e spunta la checklist; assegnare l'addetto e l'orario è di chi gestisce
      case 'conferma-pulizia': r = await M.confermaPulizia(id!, (dati.addettoId as string) || (sess.ruolo === 'Pulizie' ? sess.id : undefined), { checklistFatta: Array.isArray(dati.checklistFatta) ? (dati.checklistFatta as string[]) : undefined }); break;
      case 'annulla-pulizia': r = await M.annullaPulizia(id!, sess.ruolo === 'Pulizie' ? 180 : undefined); break;
      case 'aggiorna-pulizia': r = await M.aggiornaPulizia(id!, sess.ruolo === 'Pulizie'
        ? { note: dati.note as string | undefined, checklistFatta: Array.isArray(dati.checklistFatta) ? (dati.checklistFatta as string[]) : undefined }
        : { addettoId: dati.addettoId as string | null | undefined, oraPrevista: dati.oraPrevista as string | null | undefined, note: dati.note as string | null | undefined, checklistFatta: Array.isArray(dati.checklistFatta) ? (dati.checklistFatta as string[]) : undefined }); break;
      case 'crea-pulizia': r = await M.creaPulizia(dati as Parameters<typeof M.creaPulizia>[0]); break;
      case 'elimina-pulizia': r = await M.eliminaPulizia(id!); break;
      case 'conferma-checkin-prenotazione': r = await M.confermaCheckinPrenotazione(id!); break;
      case 'invita-collaboratore': r = await M.invitaCollaboratore(dati as Parameters<typeof M.invitaCollaboratore>[0]); break;
      // Link personale di una persona: lo restituisce (creandolo se manca) o, con rigenera, lo sostituisce.
      case 'link-accesso': r = { chiave: await M.chiaveAccessoUtente(id!, dati.rigenera === true) }; break;
      case 'attiva-utente': r = await M.impostaAttivoUtente(id!, !!dati.attivo); break;
      case 'elimina-operatore-pulizie': r = await M.eliminaOperatorePulizie(id!); break;
      case 'imposta-permesso': r = await M.impostaPermessoImmobile(dati as Parameters<typeof M.impostaPermessoImmobile>[0]); break;
      case 'anteprima-importi':
        r = await M.calcolaImportiPrenotazione(dati as Parameters<typeof M.calcolaImportiPrenotazione>[0]); break;
      case 'risolvi-schedina-ambigua':
        r = await risolviSchedinaAmbigua(id!, dati.esito === 'Inviata' ? 'Inviata' : 'Da inviare'); break;
      case 'segna-attivita': {
        const stato = String(dati.stato);
        if (stato !== 'Fatta' && stato !== 'Saltata' && stato !== 'Da fare') throw new Error('Stato non valido');
        r = await segnaAttivita(id!, stato); break;
      }
      case 'crea-regola': r = await creaRegola(dati as Parameters<typeof creaRegola>[0]); break;
      case 'aggiorna-regola': r = await aggiornaRegola(id!, dati); break;
      case 'elimina-regola': r = await eliminaRegola(id!); break;
      case 'anteprima-no-tax': r = await anteprimaNoTax(); break;
      case 'applica-no-tax': r = await applicaNoTax(Array.isArray(dati.scelte) ? (dati.scelte as { id: string; canale: string }[]) : []); break;
      case 'installa-modelli-regole': r = await installaModelliPredefiniti(); break;
      default:
        return NextResponse.json({ ok: false, error: `Azione sconosciuta: ${azione}` }, { status: 400 });
    }
    // Registro delle azioni: chi, cosa e quando. Mai dati degli ospiti: solo azione, tipo di dato e id.
    if (azione && !NON_REGISTRARE.has(azione)) {
      const esito = r as { copieEliminate?: number; schedineAnonimizzate?: number } | null;
      const dettaglio = azione === 'applica-conservazione' && esito
        ? `${esito.copieEliminate ?? 0} copie cancellate, ${esito.schedineAnonimizzate ?? 0} schedine senza numero documento`
        : null;
      await registra(sess, azione, azione.split('-').slice(1).join('-') || null, id ?? null, dettaglio);
    }
    if (azione && CAMBIANO_PRENOTAZIONI.has(azione)) {
      await riconcilia().catch((e) => console.error('[nuovo/scrivi] riconciliazione promemoria fallita (non bloccante):', e instanceof Error ? e.message : e));
    }
    return NextResponse.json({ ok: true, risultato: r });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[nuovo/scrivi]', azione, msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
