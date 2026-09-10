'use client';

import { useEffect, useState } from 'react';
import { RICORRENZE, giorniMancanti, type Ricorrenza, type Scadenza } from '@/lib/scadenze';

// Calendario scadenze fiscali/ricorrenti del B&B (estintori, imposta di soggiorno, assicurazione,
// ecc.). Dati persistiti sulla scheda "SCADENZE" del foglio Google via /api/scadenze — vedi
// src/lib/scadenze.ts per lo schema colonne e src/app/api/scadenze/route.ts per le route.
//
// Nessun dato finto: se la lista è vuota si mostra uno stato vuoto onesto, mai scadenze
// di esempio. Raffaele inserisce lui le date reali quando le ha.

// YYYY-MM-DD (input type="date") -> DD/MM/YYYY (formato usato dal foglio)
function isoToIt(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

type Urgenza = { variante: 'urgent' | 'warn' | 'good' | 'neutral'; label: string };

function urgenzaInfo(dataScadenza: string): Urgenza {
  const giorni = giorniMancanti(dataScadenza);
  if (giorni === null) return { variante: 'neutral', label: 'data non valida' };
  if (giorni < 0) {
    const n = -giorni;
    return { variante: 'urgent', label: `scaduta da ${n} giorn${n === 1 ? 'o' : 'i'}` };
  }
  if (giorni === 0) return { variante: 'urgent', label: 'scade oggi' };
  const label = `tra ${giorni} giorn${giorni === 1 ? 'o' : 'i'}`;
  if (giorni <= 30) return { variante: 'urgent', label };
  if (giorni <= 90) return { variante: 'warn', label };
  return { variante: 'good', label };
}

type FormState = {
  titolo: string;
  dataScadenza: string; // YYYY-MM-DD (valore nativo dell'input date)
  ricorrenza: Ricorrenza;
  note: string;
};

const FORM_VUOTO: FormState = { titolo: '', dataScadenza: '', ricorrenza: 'Una tantum', note: '' };

export default function ScadenzeFiscali() {
  const [scadenze, setScadenze] = useState<Scadenza[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(FORM_VUOTO);
  const [salvando, setSalvando] = useState(false);
  const [erroreForm, setErroreForm] = useState<string | null>(null);

  const [azioneInCorso, setAzioneInCorso] = useState<string | null>(null); // id della riga in elaborazione
  const [confermaEliminazione, setConfermaEliminazione] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);

  function carica() {
    setErrore(null);
    fetch('/api/scadenze')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) setScadenze(d.scadenze);
        else setErrore(d?.error || 'Errore sconosciuto nel caricamento delle scadenze.');
      })
      .catch((e) => setErrore(String(e)));
  }

  useEffect(() => {
    carica();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErroreForm(null);

    if (!form.titolo.trim()) {
      setErroreForm('Il titolo è obbligatorio.');
      return;
    }
    if (!form.dataScadenza) {
      setErroreForm('La data di scadenza è obbligatoria.');
      return;
    }
    const dataScadenza = isoToIt(form.dataScadenza);
    if (!dataScadenza) {
      setErroreForm('Data non valida.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/scadenze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titolo: form.titolo.trim(),
          dataScadenza,
          ricorrenza: form.ricorrenza,
          note: form.note.trim(),
        }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d?.error || 'Errore sconosciuto nel salvataggio');
      setForm(FORM_VUOTO);
      carica();
    } catch (e) {
      setErroreForm(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function segnaCompletata(s: Scadenza) {
    setAzioneInCorso(s.id);
    setAvviso(null);
    try {
      const res = await fetch('/api/scadenze', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d?.error || 'Errore sconosciuto');
      carica();
    } catch (e) {
      setAvviso(`Non riesco a segnare "${s.titolo}" come fatta: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAzioneInCorso(null);
    }
  }

  async function elimina(s: Scadenza) {
    if (confermaEliminazione !== s.id) {
      // primo click: chiede conferma prima di procedere.
      setConfermaEliminazione(s.id);
      return;
    }
    setConfermaEliminazione(null);
    setAzioneInCorso(s.id);
    setAvviso(null);
    try {
      const res = await fetch(`/api/scadenze?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
      const d = await res.json();
      if (!d.ok) throw new Error(d?.error || 'Errore sconosciuto');
      carica();
    } catch (e) {
      setAvviso(`Non riesco a eliminare "${s.titolo}": ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAzioneInCorso(null);
    }
  }

  return (
    <div className="panel full">
      <h3>Calendario scadenze fiscali</h3>

      {avviso && (
        <p style={{ color: 'var(--warn-ink, #a15c00)', fontSize: '.8rem', marginTop: '-.4rem', marginBottom: '.9rem' }}>
          ⚠️ {avviso}
        </p>
      )}

      {errore && (
        <p style={{ color: 'var(--warn-ink, #a15c00)' }}>Non riesco a leggere le scadenze al momento ({errore}). Riprova tra poco.</p>
      )}

      {!errore && scadenze === null && (
        <p style={{ color: 'var(--ink-muted)' }}>Caricamento scadenze…</p>
      )}

      {!errore && scadenze !== null && scadenze.length === 0 && (
        <p style={{ color: 'var(--ink-muted)' }}>
          Nessuna scadenza impostata ancora — aggiungine una qui sotto quando hai le date reali (es. ultimo controllo estintori, rinnovo assicurazione).
        </p>
      )}

      {!errore && scadenze !== null && scadenze.length > 0 && (
        <ul className="mini-list" style={{ marginBottom: '1.4rem' }}>
          {scadenze.map((s) => {
            const u = urgenzaInfo(s.dataScadenza);
            const inCorso = azioneInCorso === s.id;
            return (
              <li key={s.id} style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '.15rem', flex: '1 1 auto', minWidth: 0 }}>
                  <span style={{ fontWeight: 700 }}>{s.titolo}</span>
                  <span style={{ fontSize: '.78rem', color: 'var(--ink-muted)', fontWeight: 500 }}>
                    Scade il {s.dataScadenza}
                    {s.ricorrenza !== 'Una tantum' ? ` · ${s.ricorrenza}` : ''}
                    {s.ultimoCompletamento ? ` · ultima volta fatta il ${s.ultimoCompletamento}` : ''}
                    {s.note ? ` · ${s.note}` : ''}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flex: 'none' }}>
                  <span className={'badge ' + u.variante}>{u.label}</span>
                  <button
                    type="button"
                    className="badge good"
                    style={{ border: 'none', cursor: inCorso ? 'wait' : 'pointer', minHeight: '2.5rem' }}
                    disabled={inCorso}
                    onClick={() => segnaCompletata(s)}
                  >
                    Segna come fatto
                  </button>
                  <button
                    type="button"
                    className={'badge ' + (confermaEliminazione === s.id ? 'urgent' : 'neutral')}
                    style={{ border: 'none', cursor: inCorso ? 'wait' : 'pointer', minHeight: '2.5rem' }}
                    disabled={inCorso}
                    onClick={() => elimina(s)}
                    onBlur={() => setConfermaEliminazione((prev) => (prev === s.id ? null : prev))}
                  >
                    {confermaEliminazione === s.id ? 'Confermi? Clicca ancora' : 'Elimina'}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} style={{ borderTop: '1px solid var(--line)', paddingTop: '1.2rem' }}>
        <h4 style={{ fontSize: '.88rem', margin: '0 0 .8rem', fontWeight: 700 }}>Aggiungi una scadenza</h4>
        <div style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)', flex: '1 1 220px' }}>
            Titolo
            <input
              type="text"
              placeholder="Es: Controllo estintori"
              value={form.titolo}
              onChange={(e) => setForm((f) => ({ ...f, titolo: e.target.value }))}
              style={{ fontSize: '.88rem', padding: '.45rem .6rem', borderRadius: '.5rem', border: '1px solid var(--ink-faint)', background: 'var(--surface)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)', flex: '0 0 160px' }}>
            Data scadenza
            <input
              type="date"
              value={form.dataScadenza}
              onChange={(e) => setForm((f) => ({ ...f, dataScadenza: e.target.value }))}
              style={{ fontSize: '.88rem', padding: '.45rem .6rem', borderRadius: '.5rem', border: '1px solid var(--ink-faint)', background: 'var(--surface)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)', flex: '0 0 150px' }}>
            Ricorrenza
            <select
              value={form.ricorrenza}
              onChange={(e) => setForm((f) => ({ ...f, ricorrenza: e.target.value as Ricorrenza }))}
              style={{ fontSize: '.88rem', padding: '.45rem .6rem', borderRadius: '.5rem', border: '1px solid var(--ink-faint)', background: 'var(--surface)' }}
            >
              {RICORRENZE.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)', flex: '1 1 220px' }}>
            Note (opzionale)
            <input
              type="text"
              placeholder="Es: Tulipano, contatto fornitore..."
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              style={{ fontSize: '.88rem', padding: '.45rem .6rem', borderRadius: '.5rem', border: '1px solid var(--ink-faint)', background: 'var(--surface)' }}
            />
          </label>
          <button
            type="submit"
            className="badge good"
            style={{ border: 'none', cursor: salvando ? 'wait' : 'pointer', padding: '.55rem 1rem', fontSize: '.82rem' }}
            disabled={salvando}
          >
            {salvando ? 'Salvo…' : 'Aggiungi'}
          </button>
        </div>
        {erroreForm && <p style={{ color: 'var(--urgent, #d5473c)', fontSize: '.8rem', marginTop: '.6rem' }}>{erroreForm}</p>}
      </form>

      <p style={{ color: 'var(--ink-faint)', fontSize: '.8rem', marginTop: '1.3rem' }}>
        Le scadenze sono salvate sulla scheda &quot;SCADENZE&quot; del foglio Google (stesso spreadsheet delle prenotazioni). &quot;Segna come fatto&quot;
        registra la data di completamento e, se la scadenza è ricorrente, calcola in automatico la prossima sommando l&apos;intervallo scelto.
      </p>
    </div>
  );
}
