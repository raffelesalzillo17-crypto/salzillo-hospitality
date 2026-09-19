import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import * as M from '@/lib/db/mutations';

// Route di scrittura del nuovo sistema. Un solo endpoint che smista in base ad `azione`
// (è un gestionale interno, non un'API pubblica — semplice e sufficiente).
// Tutto passa dalla sessione (src/lib/db/auth.ts). Solo il Titolare può scrivere per ora;
// i permessi granulari per collaboratore si affinano quando ci sarà davvero un collaboratore.

export const dynamic = 'force-dynamic';

const SOLO_TITOLARE = new Set(['invita-collaboratore', 'imposta-permesso', 'attiva-utente']);

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;

  let body: { azione?: string; id?: string; dati?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }
  const { azione, id, dati = {} } = body;

  const puoScrivere = sess.ruolo === 'Titolare' || sess.ruolo === 'Collaboratore'
    || (sess.ruolo === 'Pulizie' && azione === 'conferma-pulizia');
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
      case 'aggiungi-pagamento': r = await M.aggiungiPagamento(dati as Parameters<typeof M.aggiungiPagamento>[0]); break;
      case 'crea-proprietario': r = await M.creaProprietario(dati as Parameters<typeof M.creaProprietario>[0]); break;
      case 'aggiorna-proprietario': r = await M.aggiornaProprietario(id!, dati); break;
      case 'crea-immobile': r = await M.creaImmobile(dati as Parameters<typeof M.creaImmobile>[0]); break;
      case 'aggiorna-immobile': r = await M.aggiornaImmobile(id!, dati); break;
      case 'crea-alloggio': r = await M.creaAlloggio(dati as Parameters<typeof M.creaAlloggio>[0]); break;
      case 'aggiorna-alloggio': r = await M.aggiornaAlloggio(id!, dati); break;
      case 'crea-spesa': r = await M.creaSpesa(dati as Parameters<typeof M.creaSpesa>[0]); break;
      case 'crea-scadenza': r = await M.creaScadenza(dati as Parameters<typeof M.creaScadenza>[0]); break;
      case 'seed-scadenze': r = await M.seedScadenzeTipiche(); break;
      case 'crea-preventivo': r = await M.creaPreventivo({ ...(dati as Parameters<typeof M.creaPreventivo>[0]), creatoDa: sess.id }); break;
      case 'stato-preventivo': r = await M.aggiornaStatoPreventivo(id!, String(dati.stato)); break;
      case 'accetta-preventivo': r = await M.accettaPreventivo(id!, sess.id); break;
      case 'elimina-preventivo': r = await M.eliminaPreventivo(id!); break;
      case 'crea-preventivo-da-richiesta': r = await M.creaPreventivoDaRichiesta(id!, { ...(dati as Parameters<typeof M.creaPreventivoDaRichiesta>[1]), creatoDa: sess.id }); break;
      case 'ignora-richiesta': r = await M.ignoraRichiestaPubblica(id!); break;
      case 'crea-evento': r = await M.creaEventoLocale(dati as Parameters<typeof M.creaEventoLocale>[0]); break;
      case 'aggiorna-evento': r = await M.aggiornaEventoLocale(id!, dati); break;
      case 'cancella-evento': r = await M.cancellaEventoLocale(id!); break;
      case 'crea-prezzo': r = await M.creaPrezzoPeriodo(dati as Parameters<typeof M.creaPrezzoPeriodo>[0]); break;
      case 'cancella-prezzo': r = await M.cancellaPrezzoPeriodo(id!); break;
      case 'crea-contratto-gestione': r = await M.creaContrattoGestione(dati as Parameters<typeof M.creaContrattoGestione>[0]); break;
      case 'aggiorna-contratto-gestione': r = await M.aggiornaContrattoGestione(id!, dati); break;
      case 'completa-scadenza': r = await M.completaScadenza(id!); break;
      case 'conferma-pulizia': r = await M.confermaPulizia(id!, (dati.addettoId as string) || sess.id); break;
      case 'crea-pulizia': r = await M.creaPulizia(dati as Parameters<typeof M.creaPulizia>[0]); break;
      case 'elimina-pulizia': r = await M.eliminaPulizia(id!); break;
      case 'conferma-checkin-prenotazione': r = await M.confermaCheckinPrenotazione(id!); break;
      case 'invita-collaboratore': r = await M.invitaCollaboratore(dati as Parameters<typeof M.invitaCollaboratore>[0]); break;
      case 'attiva-utente': r = await M.impostaAttivoUtente(id!, !!dati.attivo); break;
      case 'imposta-permesso': r = await M.impostaPermessoImmobile(dati as Parameters<typeof M.impostaPermessoImmobile>[0]); break;
      case 'anteprima-importi':
        r = await M.calcolaImportiPrenotazione(dati as Parameters<typeof M.calcolaImportiPrenotazione>[0]); break;
      default:
        return NextResponse.json({ ok: false, error: `Azione sconosciuta: ${azione}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, risultato: r });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[nuovo/scrivi]', azione, msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
