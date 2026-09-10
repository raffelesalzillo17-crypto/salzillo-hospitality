'use client';

import { useEffect, useState } from 'react';

// Elenco di sola lettura degli ultimi contratti generati, letto dalla scheda "CONTRATTI" del
// foglio Google (audit trail scritto da src/app/api/contratto/route.ts dopo ogni generazione PDF
// riuscita). Nessun dato inventato: se il foglio non ha ancora righe, stato vuoto onesto.
// Vedi src/app/api/contratto/route.ts per lo schema esatto (stessa forma restituita da GET).

type ContrattoLoggato = {
  row: number;
  dataGenerazione: string; // ISO
  ospite: string;
  stanza: string;
  checkin: string;
  checkout: string;
  canale: string;
  importoLordo: number | null;
  note: string;
};

function fmtData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '—';
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function UltimiContratti() {
  const [contratti, setContratti] = useState<ContrattoLoggato[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let annullato = false;
    fetch('/api/contratto')
      .then((r) => r.json())
      .then((d) => {
        if (annullato) return;
        if (d && d.ok) setContratti(d.contratti);
        else setErrore(d?.error || 'Errore sconosciuto nel caricamento dei contratti.');
      })
      .catch((e) => { if (!annullato) setErrore(String(e)); });
    return () => { annullato = true; };
  }, []);

  return (
    <div className="panel full">
      <h3 style={{ margin: '0 0 .6rem', fontSize: '.95rem' }}>Ultimi contratti generati</h3>
      {errore && <p style={{ margin: 0, color: 'var(--warn, #a15c00)', fontSize: '.8rem' }}>{errore}</p>}
      {!errore && contratti === null && (
        <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: '.82rem' }}>Caricamento…</p>
      )}
      {!errore && contratti !== null && contratti.length === 0 && (
        <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: '.82rem' }}>Nessun contratto generato finora.</p>
      )}
      {!errore && contratti !== null && contratti.length > 0 && (
        <ul className="mini-list">
          {contratti.map((c) => (
            <li key={c.row}>
              <span className="when">{fmtData(c.dataGenerazione)}</span>
              <span>
                {c.ospite || '(ospite non specificato)'} — {c.stanza || '(stanza non specificata)'} · {c.checkin || '?'} → {c.checkout || '?'}
                {c.canale ? ` · ${c.canale}` : ''}
                {c.importoLordo != null ? ` · €${c.importoLordo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
