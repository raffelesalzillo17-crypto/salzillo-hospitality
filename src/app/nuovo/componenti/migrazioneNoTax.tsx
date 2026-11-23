'use client';

import { useState } from 'react';
import { api, dataIt, eur } from '../utilita';

// Punto 3 (23/11/2026): "No Tax" non è un canale ma un regime fiscale. Qui il titolare vede l'elenco, sceglie il canale vero di ogni
// prenotazione e conferma. Nulla si sposta da solo. Il regime "No Tax" resta sulla prenotazione: Alloggiati, ricevute e cedolare non cambiano.
type Riga = { id: string; ospite: string; alloggio: string; checkin: string; checkout: string; lordo: number; stato: string; canaleProposto: string };
const DESTINAZIONI = ['Diretto', 'Airbnb', 'Booking'];

export function MigrazioneNoTax({ presenti, onCambiato }: { presenti: number; onCambiato: () => Promise<void> }) {
  const [righe, setRighe] = useState<Riga[] | null>(null);
  const [canali, setCanali] = useState<Record<string, string>>({});
  const [scelte, setScelte] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function mostra() {
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = (await api('anteprima-no-tax')) as Riga[];
      setRighe(r);
      setCanali(Object.fromEntries(r.map((x) => [x.id, x.canaleProposto])));
      setScelte(Object.fromEntries(r.map((x) => [x.id, false])));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  const scelte_ = (righe ?? []).filter((r) => scelte[r.id]);

  async function applica() {
    if (scelte_.length === 0) return;
    if (!confirm(`Spostare ${scelte_.length} prenotazioni dal canale "No Tax" al canale scelto?\n\nIl regime resta "No Tax": restano escluse da Alloggiati Web, ricevute e cedolare, come adesso. Si può annullare col rollback 0012.`)) return;
    setBusy(true); setErr('');
    try {
      const r = (await api('applica-no-tax', { dati: { scelte: scelte_.map((x) => ({ id: x.id, canale: canali[x.id] })) } })) as { spostate: number; invariate: number };
      setMsg(`✓ Spostate ${r.spostate} prenotazioni${r.invariate ? ` (${r.invariate} non erano più No Tax)` : ''}.`);
      await onCambiato();
      await mostra();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="cardhead"><h2>Canale &ldquo;No Tax&rdquo; <small>({presenti} prenotazioni)</small></h2>
        <button className="mini" disabled={busy} onClick={mostra}>{righe ? '↻ Aggiorna elenco' : 'Vedi anteprima'}</button>
      </div>
      <p className="sub" style={{ marginTop: -4 }}>
        &ldquo;No Tax&rdquo; non è un canale ma un regime fiscale: ora è un campo a parte (Regime fiscale), già impostato su &ldquo;No Tax&rdquo; per queste prenotazioni.
        Qui scegli il canale vero di ognuna (da dove è arrivata). Non si sposta nulla da solo e il trattamento non cambia: restano fuori da Alloggiati Web, ricevute e cedolare.
      </p>
      {err && <p className="err">{err}</p>}
      {msg && <p className="empty" style={{ color: '#1FAA6E' }}>{msg}</p>}
      {righe && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '6px 0' }}>
            <button className="mini" onClick={() => setScelte(Object.fromEntries(righe.map((x) => [x.id, true])))}>Seleziona tutte</button>
            <button className="mini" onClick={() => setScelte(Object.fromEntries(righe.map((x) => [x.id, false])))}>Nessuna</button>
            <button className="mini coral" disabled={busy || scelte_.length === 0} onClick={applica}>Sposta le {scelte_.length} scelte</button>
          </div>
          <div className="tablescroll">
            <table className="tbl full">
              <thead><tr><th></th><th>Check-in</th><th>Ospite</th><th>Alloggio</th><th className="num">Lordo</th><th>Stato</th><th>Canale proposto</th></tr></thead>
              <tbody>
                {righe.map((r) => (
                  <tr key={r.id}>
                    <td><input type="checkbox" checked={!!scelte[r.id]} onChange={(e) => setScelte({ ...scelte, [r.id]: e.target.checked })} /></td>
                    <td>{dataIt(r.checkin)}</td><td>{r.ospite}</td><td>{r.alloggio}</td><td className="num">{eur(r.lordo)}</td><td><small>{r.stato}</small></td>
                    <td><select value={canali[r.id]} onChange={(e) => setCanali({ ...canali, [r.id]: e.target.value })}>{DESTINAZIONI.map((c) => <option key={c}>{c}</option>)}</select></td>
                  </tr>
                ))}
                {righe.length === 0 && <tr><td colSpan={7} className="empty">Nessuna prenotazione è più sul canale No Tax.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
