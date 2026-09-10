import { NextRequest, NextResponse } from 'next/server';
import {
  leggiPrenotazioniDb, leggiOspitiDb, leggiAnagraficaDb, leggiAlloggiDb,
  leggiSpeseDb, leggiScadenzeDb, riepilogoMeseDb, cosaMancaDb,
} from '@/lib/db/queries';

// Tutti i dati per la nuova interfaccia (/nuovo), letti dal database.
// Protetta dalla chiave di Motore Rafilu — è un'anteprima privata del nuovo sistema, non
// ancora la fonte viva (vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md).

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-plancia-key');
  if (process.env.PLANCIA_ACCESS_KEY && key !== process.env.PLANCIA_ACCESS_KEY) {
    return NextResponse.json({ ok: false, error: 'Chiave non valida' }, { status: 401 });
  }

  try {
    const oggi = new Date();
    const oggiISO = oggi.toISOString().slice(0, 10);
    const [prenotazioni, ospiti, anagrafica, alloggi, spese, scadenze, riepilogoMese, cosaManca] = await Promise.all([
      leggiPrenotazioniDb(),
      leggiOspitiDb(),
      leggiAnagraficaDb(),
      leggiAlloggiDb(),
      leggiSpeseDb(),
      leggiScadenzeDb(),
      riepilogoMeseDb(oggi.getFullYear(), oggi.getMonth() + 1),
      cosaMancaDb(oggiISO),
    ]);

    return NextResponse.json({
      ok: true,
      oggi: oggiISO,
      prenotazioni,
      ospiti,
      anagrafica,
      alloggi,
      spese,
      scadenze,
      cosaManca,
      riepilogoMese: riepilogoMese.map((r) => ({
        immobile: r.immobile, proprietario: r.proprietario,
        prenotazioni: r.prenotazioni, lordo: Number(r.lordo),
        utile: Number(r.utile), nettoProprietario: Number(r.nettoProprietario),
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[nuovo/dati] ERRORE:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
