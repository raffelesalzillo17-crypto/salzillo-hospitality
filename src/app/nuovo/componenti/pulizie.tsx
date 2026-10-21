'use client';

import { useState } from 'react';
import type { Operatore, Pulizia } from '../tipi';
import { api, dataIt, eur } from '../utilita';

// ── Pulizie ──────────────────────────────────────────────────────────────────
export function RigaPulizia({ pu, operatori, oggi, puoGestire, onCambiato }: {
  pu: Pulizia; operatori: Operatore[]; oggi: string; puoGestire: boolean; onCambiato: () => Promise<void>;
}) {
  const [addettoId, setAddettoId] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="docrow">
      <span className={`pill ${pu.data < oggi ? 'pill-Scaduto' : 'pill-Bozza'}`}>{dataIt(pu.data)}</span>
      <b>{pu.alloggio}</b>
      {pu.pagata && <span className="chip" style={{ background: '#1FAA6E22', color: '#1FAA6E' }}>pagata{pu.importo ? ` · ${eur(Number(pu.importo))}` : ''}</span>}
      {pu.note && <span className="empty" style={{ flexBasis: '100%' }}>{pu.note}</span>}
      {puoGestire && <span className="azioni">
        {operatori.length > 0 && (
          <select value={addettoId} onChange={(e) => setAddettoId(e.target.value)} style={{ maxWidth: 140 }}>
            <option value="">chi ha pulito?</option>
            {operatori.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        )}
        <button className="mini" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await api('conferma-pulizia', { id: pu.id, dati: { addettoId: addettoId || undefined } }); await onCambiato(); }
          finally { setBusy(false); }
        }}>{busy ? '…' : '✓ fatto'}</button>
        {pu.origine !== 'Foglio' && <button className="danger" onClick={async () => { if (confirm('Eliminare questa pulizia?')) { await api('elimina-pulizia', { id: pu.id }); await onCambiato(); } }}>elimina</button>}
      </span>}
    </div>
  );
}
