'use client';

import { useEffect, useState } from 'react';
import type { Campo, Tema } from '../tipi';
import { applicaTema } from '../utilita';

export function FormModale({ titolo, campi, iniziali = {}, onInvia, onClose }: {
  titolo: string; campi: Campo[]; iniziali?: Record<string, unknown>;
  onInvia: (v: Record<string, unknown>) => Promise<void>; onClose: () => void;
}) {
  const [v, setV] = useState<Record<string, unknown>>(() => {
    const o: Record<string, unknown> = {};
    for (const c of campi) {
      if (iniziali[c.k] !== undefined) { o[c.k] = iniziali[c.k]; continue; }
      // Un <select> senza valore iniziale mostra comunque la prima opzione selezionata (comportamento
      // nativo del browser quando il value controllato non combacia con nessuna opzione) — ma lo
      // stato React restava vuoto, quindi un campo select obbligatorio risultava per sempre "mancante"
      // (bottone Salva disabilitato per sempre) anche se in UI sembrava già valorizzato. Bug scoperto
      // il 22/09/2026: "Nuova spesa" non aveva MAI salvato nulla (0 spese in tutto il sistema) perché
      // il campo Categoria, obbligatorio, non veniva mai considerato compilato finché non lo si
      // riapriva a mano. Difetto dello stesso FormModale, quindi presente in ogni form che lo usa
      // (Spese, Scadenze, Ospiti, Immobili/Alloggi...), non solo in quello dove è stato notato.
      if (c.tipo === 'select' && c.opzioni && c.opzioni.length > 0) { o[c.k] = c.opzioni[0].v; continue; }
      o[c.k] = c.tipo === 'checkbox' ? false : '';
    }
    return o;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const mancano = campi.some((c) => c.req && !v[c.k]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>✕</button>
        <h2>{titolo}</h2>
        <div className="form">
          {campi.map((c) => (
            <label key={c.k}>{c.label}
              {c.tipo === 'select'
                ? <select value={String(v[c.k] ?? '')} onChange={(e) => setV({ ...v, [c.k]: e.target.value })}>
                    {(c.opzioni ?? []).map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                  </select>
                : c.tipo === 'textarea'
                ? <textarea rows={6} value={String(v[c.k] ?? '')} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
                : c.tipo === 'checkbox'
                ? <input type="checkbox" checked={!!v[c.k]} onChange={(e) => setV({ ...v, [c.k]: e.target.checked })} style={{ width: 'auto', alignSelf: 'flex-start' }} />
                : <input type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'} step={c.tipo === 'number' ? '0.01' : undefined}
                    value={String(v[c.k] ?? '')} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />}
            </label>
          ))}
        </div>
        <div className="modalactions">
          <button className="add" disabled={busy || mancano} onClick={async () => {
            setBusy(true); setErr('');
            try {
              const out: Record<string, unknown> = {};
              for (const c of campi) {
                const raw = v[c.k];
                out[c.k] = c.tipo === 'number' ? (raw === '' ? undefined : Number(raw)) : raw === '' ? undefined : raw;
              }
              await onInvia(out);
            } catch (e) { setErr(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
          }}>{busy ? 'salvo…' : 'Salva'}</button>
          <button onClick={onClose}>Annulla</button>
        </div>
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}

export function TemaToggle() {
  const [t, setT] = useState<Tema>('auto');
  useEffect(() => {
    let v: Tema = 'auto';
    try { v = (localStorage.getItem('sh_tema') as Tema) || 'auto'; } catch { /* */ }
    setT(v); applicaTema(v);
  }, []);
  function scegli(v: Tema) {
    setT(v); applicaTema(v);
    try { localStorage.setItem('sh_tema', v); } catch { /* */ }
  }
  const next: Record<Tema, Tema> = { auto: 'light', light: 'dark', dark: 'auto' };
  const icona: Record<Tema, string> = { auto: '🌗', light: '☀️', dark: '🌙' };
  const label: Record<Tema, string> = { auto: 'automatico', light: 'chiaro', dark: 'scuro' };
  return (
    <button className="tematoggle" onClick={() => scegli(next[t])} title={`Tema: ${label[t]} — tocca per cambiare`}>
      {icona[t]} <span>{label[t]}</span>
    </button>
  );
}
