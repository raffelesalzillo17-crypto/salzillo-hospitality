'use client';

import { useState } from 'react';

// Stessa forma restituita da GET /api/prenotazioni (vedi src/app/api/prenotazioni/route.ts).
// `telefono` non è usato qui ma è tipicamente presente sull'oggetto passato dal chiamante.
type Prenotazione = {
  row: number;
  checkin: string;   // DD/MM/YYYY
  checkout: string;  // DD/MM/YYYY
  ospite: string;
  stanza: string;
  canale: string;
  lordo: number;
  telefono?: string;
};

const STANZE_TITOLARE_NOTO = ['Tulipano', 'Rosa'];

export default function RicevutaButton({ prenotazione }: { prenotazione: Prenotazione }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titolareNoto = STANZE_TITOLARE_NOTO.includes(prenotazione.stanza);
  const [intestatario, setIntestatario] = useState(titolareNoto ? 'Luigi Salzillo' : '');
  const [indirizzoStruttura, setIndirizzoStruttura] = useState(titolareNoto ? 'Via Clanio 60, Marcianise (CE)' : '');
  const [cf, setCf] = useState(titolareNoto ? 'SLZLGU74C08E932O' : '');
  const [impostaSoggiorno, setImpostaSoggiorno] = useState('');

  async function generaPdf() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ricevuta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ospite: prenotazione.ospite,
          stanza: prenotazione.stanza,
          checkin: prenotazione.checkin,
          checkout: prenotazione.checkout,
          canale: prenotazione.canale,
          lordo: prenotazione.lordo,
          intestatario: intestatario || undefined,
          indirizzoStruttura: indirizzoStruttura || undefined,
          cf: cf || undefined,
          impostaSoggiorno: impostaSoggiorno.trim() === '' ? null : parseFloat(impostaSoggiorno.replace(',', '.')),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Errore ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ricevuta-${prenotazione.stanza.replace(/\s+/g, '')}-${prenotazione.ospite.replace(/\s+/g, '')}.pdf`.toLowerCase();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (prenotazione.canale === 'No Tax') {
    return (
      <span style={{ fontSize: '.78rem', color: 'var(--ink-muted, #888)' }}>
        — (No Tax)
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: '.78rem', padding: '.3rem .6rem', borderRadius: '.4rem', minHeight: '2.75rem',
          border: '1px solid var(--ink-faint, #ccc)', background: 'transparent', cursor: 'pointer',
        }}
      >
        Ricevuta
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={() => !loading && setOpen(false)}
    >
      <div
        style={{
          background: 'var(--bg, #fff)', color: 'var(--ink, #111)', borderRadius: '.6rem',
          padding: '1.2rem', width: '22rem', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '.6rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Ricevuta — {prenotazione.ospite}</h3>
        <p style={{ margin: 0, fontSize: '.78rem', color: 'var(--ink-muted, #666)' }}>
          {prenotazione.stanza} · {prenotazione.checkin} → {prenotazione.checkout} · €{prenotazione.lordo}
        </p>

        {!titolareNoto && (
          <p style={{ margin: 0, fontSize: '.75rem', color: '#a15c00' }}>
            Intestatario non confermato per questa stanza — compilalo prima di generare.
          </p>
        )}

        <label style={{ fontSize: '.78rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Intestatario
          <input value={intestatario} onChange={(e) => setIntestatario(e.target.value)} placeholder="Nome e cognome" />
        </label>
        <label style={{ fontSize: '.78rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Indirizzo struttura
          <input value={indirizzoStruttura} onChange={(e) => setIndirizzoStruttura(e.target.value)} placeholder="Via, civico, comune" />
        </label>
        <label style={{ fontSize: '.78rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          P.IVA / Codice fiscale
          <input value={cf} onChange={(e) => setCf(e.target.value)} placeholder="CF o P.IVA" />
        </label>
        <label style={{ fontSize: '.78rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Imposta di soggiorno (facoltativa — Comune di Marcianise: nessuna imposta risulta attualmente in vigore)
          <input value={impostaSoggiorno} onChange={(e) => setImpostaSoggiorno(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </label>

        {error && <p style={{ margin: 0, fontSize: '.78rem', color: '#c0392b' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '.4rem' }}>
          <button type="button" onClick={() => setOpen(false)} disabled={loading} style={{ fontSize: '.8rem', padding: '.35rem .7rem', minHeight: '2.75rem' }}>
            Annulla
          </button>
          <button type="button" onClick={generaPdf} disabled={loading} style={{ fontSize: '.8rem', padding: '.35rem .7rem', fontWeight: 600, minHeight: '2.75rem' }}>
            {loading ? 'Genero…' : 'Genera ricevuta'}
          </button>
        </div>
      </div>
    </div>
  );
}
