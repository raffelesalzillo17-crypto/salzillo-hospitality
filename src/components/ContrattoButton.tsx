'use client';

import { useState } from 'react';

// Stessa forma restituita da GET /api/prenotazioni (vedi src/app/api/prenotazioni/route.ts).
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

export default function ContrattoButton({ prenotazione }: { prenotazione: Prenotazione }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titolareNoto = STANZE_TITOLARE_NOTO.includes(prenotazione.stanza);
  const [intestatario, setIntestatario] = useState(titolareNoto ? 'Luigi Salzillo' : '');
  const [indirizzoStruttura, setIndirizzoStruttura] = useState(titolareNoto ? 'Via Clanio 60, Marcianise (CE)' : '');
  const [cf, setCf] = useState(titolareNoto ? 'SLZLGU74C08E932O' : '');
  const [documentoOspite, setDocumentoOspite] = useState('');
  const [cfOspite, setCfOspite] = useState('');
  const [cauzione, setCauzione] = useState('');
  const [giorniPreavviso, setGiorniPreavviso] = useState('3');

  async function generaPdf() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/contratto', {
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
          documentoOspite: documentoOspite || undefined,
          cfOspite: cfOspite || undefined,
          cauzione: cauzione.trim() === '' ? null : parseFloat(cauzione.replace(',', '.')),
          giorniPreavvisoCancellazione: giorniPreavviso.trim() === '' ? 3 : parseInt(giorniPreavviso, 10),
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
      a.download = `bozza-contratto-${prenotazione.stanza.replace(/\s+/g, '')}-${prenotazione.ospite.replace(/\s+/g, '')}.pdf`.toLowerCase();
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
        Contratto
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        padding: '1rem', overflowY: 'auto',
      }}
      onClick={() => !loading && setOpen(false)}
    >
      <div
        style={{
          background: 'var(--bg, #fff)', color: 'var(--ink, #111)', borderRadius: '.6rem',
          padding: '1.2rem', width: '26rem', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '.6rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Contratto — {prenotazione.ospite}</h3>
        <p style={{ margin: 0, fontSize: '.78rem', color: 'var(--ink-muted, #666)' }}>
          {prenotazione.stanza} · {prenotazione.checkin} → {prenotazione.checkout} · €{prenotazione.lordo} · {prenotazione.canale}
        </p>

        <p style={{
          margin: 0, fontSize: '.75rem', fontWeight: 700, color: '#b40707',
          background: '#fdeaea', border: '1px solid #f0b8b8', borderRadius: '.4rem', padding: '.5rem .6rem',
        }}>
          BOZZA — questo contratto non è stato revisionato da un legale. Non usarlo con ospiti reali prima di farlo controllare da un commercialista/legale.
        </p>

        {!titolareNoto && (
          <p style={{ margin: 0, fontSize: '.75rem', color: '#a15c00' }}>
            Intestatario non confermato per questa stanza — compilalo prima di generare.
          </p>
        )}

        <label style={{ fontSize: '.78rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Intestatario (locatore)
          <input value={intestatario} onChange={(e) => setIntestatario(e.target.value)} placeholder="Nome e cognome" />
        </label>
        <label style={{ fontSize: '.78rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Indirizzo struttura
          <input value={indirizzoStruttura} onChange={(e) => setIndirizzoStruttura(e.target.value)} placeholder="Via, civico, comune" />
        </label>
        <label style={{ fontSize: '.78rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Codice fiscale / P.IVA locatore
          <input value={cf} onChange={(e) => setCf(e.target.value)} placeholder="CF o P.IVA" />
        </label>
        <label style={{ fontSize: '.78rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Documento ospite (facoltativo, se già disponibile)
          <input value={documentoOspite} onChange={(e) => setDocumentoOspite(e.target.value)} placeholder="es. Carta d'identità n. ..." />
        </label>
        <label style={{ fontSize: '.78rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Codice fiscale ospite (facoltativo)
          <input value={cfOspite} onChange={(e) => setCfOspite(e.target.value)} placeholder="CF ospite" />
        </label>
        <label style={{ fontSize: '.78rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Deposito cauzionale (facoltativo — vuoto/0 se non richiesto)
          <input value={cauzione} onChange={(e) => setCauzione(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </label>
        <label style={{ fontSize: '.78rem', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
          Preavviso cancellazione gratuita (giorni prima del check-in — modificabile)
          <input value={giorniPreavviso} onChange={(e) => setGiorniPreavviso(e.target.value)} placeholder="3" inputMode="numeric" />
        </label>

        {error && <p style={{ margin: 0, fontSize: '.78rem', color: '#c0392b' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '.4rem' }}>
          <button type="button" onClick={() => setOpen(false)} disabled={loading} style={{ fontSize: '.8rem', padding: '.35rem .7rem', minHeight: '2.75rem' }}>
            Annulla
          </button>
          <button type="button" onClick={generaPdf} disabled={loading} style={{ fontSize: '.8rem', padding: '.35rem .7rem', fontWeight: 600, minHeight: '2.75rem' }}>
            {loading ? 'Genero…' : 'Genera bozza contratto'}
          </button>
        </div>
      </div>
    </div>
  );
}
