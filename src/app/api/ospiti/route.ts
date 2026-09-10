import { NextRequest, NextResponse } from 'next/server';
import { elencoOspiti, trovaOspite } from '@/lib/ospiti';
import { elencaDocumenti } from '@/lib/documenti';
import { getSheetsClient, fileIdForTab } from '@/lib/sheets';

// Anagrafica ospiti — solo Motore Rafilu (Raffaele), stessa chiave di tutta la dashboard.
// GET senza parametri: elenco ospiti. GET ?id=osp_xxx: dettaglio con storico soggiorni e
// documenti collegati.

function checkPlanciaKey(req: NextRequest): boolean {
  const expected = process.env.PLANCIA_ACCESS_KEY;
  const provided = req.headers.get('x-plancia-key');
  return !expected || provided === expected;
}

function normalizzaTelefono(tel: string): string {
  return tel.replace(/[^\d+]/g, '');
}

async function storicoSoggiorni(nome: string, telefono: string) {
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: fileIdForTab('DATABASE'),
    range: 'DATABASE!B2:K1000',
  });
  const rows = res.data.values ?? [];
  const telNorm = telefono ? normalizzaTelefono(telefono) : '';

  return rows
    .map((row, idx) => {
      const [checkin, checkout, ospiteRiga, stanza, canale, lordo, stato, , , telefonoRiga] = row;
      if (!checkin || !ospiteRiga) return null;
      const stessoTelefono = telNorm && telefonoRiga && normalizzaTelefono(String(telefonoRiga)) === telNorm;
      const stessoNome = String(ospiteRiga).trim().toLowerCase() === nome.trim().toLowerCase();
      if (!stessoTelefono && !stessoNome) return null;
      return {
        row: idx + 2,
        checkin: String(checkin),
        checkout: String(checkout ?? ''),
        stanza: String(stanza ?? ''),
        canale: String(canale ?? ''),
        lordo: parseFloat(String(lordo ?? 0)) || 0,
        stato: String(stato ?? 'Attiva'),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a!.checkin < b!.checkin ? 1 : -1)); // più recente prima
}

export async function GET(req: NextRequest) {
  if (!checkPlanciaKey(req)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    try {
      const ospiti = await elencoOspiti();
      return NextResponse.json({ ok: true, ospiti });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  try {
    const ospite = await trovaOspite(id);
    if (!ospite) return NextResponse.json({ error: 'Ospite non trovato' }, { status: 404 });

    const [soggiorni, documenti] = await Promise.all([
      storicoSoggiorni(ospite.nome, ospite.telefono),
      elencaDocumenti(ospite.ospiteId, ospite.nome).catch((e) => {
        console.error('[ospiti] elencaDocumenti fallito (non bloccante):', e instanceof Error ? e.message : e);
        return [];
      }),
    ]);

    return NextResponse.json({ ok: true, ospite, soggiorni, documenti });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
