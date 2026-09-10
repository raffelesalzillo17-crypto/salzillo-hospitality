'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  TIPI_DOCUMENTO,
  RAPPORTO_CAPOFAMIGLIA,
  RAPPORTO_OSPITE,
  STATO_DA_INVIARE,
  STATO_INVIATO_MANUALMENTE,
  formattaSchedinaPerCopia,
  type Schedina,
} from '@/lib/schedine';

// Stessa forma restituita da GET /api/prenotazioni (vedi src/app/api/prenotazioni/route.ts).
type Prenotazione = {
  row: number;
  checkin: string;  // DD/MM/YYYY
  checkout: string; // DD/MM/YYYY
  ospite: string;
  stanza: string;
  canale: string;
  stato: string;
};

function parseItDate(s: string): Date | null {
  const [d, m, y] = (s || '').split('/').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}
function todayMid() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function formatItDate(d: Date): string {
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getFullYear()),
  ].join('/');
}
function nottiTra(checkin: Date, checkout: Date | null): string {
  if (!checkout) return '';
  const diff = Math.round((checkout.getTime() - checkin.getTime()) / 86400000);
  return diff > 0 ? String(diff) : '';
}
// Divide "Mario Rossi" in { nome: 'Mario', cognome: 'Rossi' } — solo un suggerimento di
// partenza per il form, l'operatore lo corregge se serve (nomi composti, ordine diverso, ecc.).
function suddividiNome(ospite: string): { nome: string; cognome: string } {
  const parti = ospite.trim().split(/\s+/);
  if (parti.length < 2) return { nome: ospite.trim(), cognome: '' };
  return { nome: parti[0], cognome: parti.slice(1).join(' ') };
}

type FormState = {
  dataArrivo: string;
  notti: string;
  stanza: string;
  cognome: string;
  nome: string;
  dataNascita: string;
  luogoNascita: string;
  cittadinanza: string;
  tipoDocumento: string;
  numeroDocumento: string;
  rapporto: string;
};

const inputStyle: CSSProperties = {
  fontSize: '.82rem', padding: '.35rem .5rem', borderRadius: '.4rem',
  border: '1px solid var(--ink-faint, #ccc)', background: 'var(--surface)', width: '100%',
};
const labelStyle: CSSProperties = { fontSize: '.75rem', display: 'flex', flexDirection: 'column', gap: '.2rem' };

type FormOspiteProps = {
  prenotazione: Prenotazione;
  numeroOspiteGiaCompilati: number;
  onClose: () => void;
  onSaved: () => void;
};

function FormOspite({ prenotazione, numeroOspiteGiaCompilati, onClose, onSaved }: FormOspiteProps) {
  const co = parseItDate(prenotazione.checkin);
  const cout = parseItDate(prenotazione.checkout);
  const { nome: nomeSuggerito, cognome: cognomeSuggerito } = suddividiNome(prenotazione.ospite);

  const [form, setForm] = useState<FormState>({
    dataArrivo: prenotazione.checkin,
    notti: co ? nottiTra(co, cout) : '',
    stanza: prenotazione.stanza,
    cognome: numeroOspiteGiaCompilati === 0 ? cognomeSuggerito : '',
    nome: numeroOspiteGiaCompilati === 0 ? nomeSuggerito : '',
    dataNascita: '',
    luogoNascita: '',
    cittadinanza: '',
    tipoDocumento: TIPI_DOCUMENTO[0],
    numeroDocumento: '',
    rapporto: numeroOspiteGiaCompilati === 0 ? RAPPORTO_CAPOFAMIGLIA : RAPPORTO_OSPITE,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function salva() {
    setError(null);
    for (const [campo, valore] of Object.entries(form)) {
      if (!String(valore).trim()) {
        setError(`Campo mancante: ${campo}`);
        return;
      }
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.dataArrivo) || !/^\d{2}\/\d{2}\/\d{4}$/.test(form.dataNascita)) {
      setError('Le date vanno in formato GG/MM/AAAA');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/schedine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, prenotazioneRow: prenotazione.row }),
      });
      const d = await res.json();
      if (!d?.ok) throw new Error(d?.error || 'Errore sconosciuto nel salvataggio');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={() => !saving && onClose()}
    >
      <div
        style={{ background: 'var(--bg, #fff)', color: 'var(--ink, #111)', borderRadius: '.6rem', padding: '1.2rem', width: '26rem', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '.6rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Schedina ospite — {prenotazione.stanza}</h3>
        <p style={{ margin: 0, fontSize: '.78rem', color: 'var(--ink-muted, #666)' }}>
          Prenotazione: {prenotazione.ospite} · check-in {prenotazione.checkin}
          {numeroOspiteGiaCompilati > 0 && ` · ${numeroOspiteGiaCompilati}° ospite già compilato per questa prenotazione`}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
          <label style={labelStyle}>Data arrivo (GG/MM/AAAA)
            <input style={inputStyle} value={form.dataArrivo} onChange={(e) => set('dataArrivo', e.target.value)} placeholder="GG/MM/AAAA" />
          </label>
          <label style={labelStyle}>Notti
            <input style={inputStyle} value={form.notti} onChange={(e) => set('notti', e.target.value)} inputMode="numeric" />
          </label>
        </div>
        <label style={labelStyle}>Stanza
          <input style={inputStyle} value={form.stanza} onChange={(e) => set('stanza', e.target.value)} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
          <label style={labelStyle}>Cognome
            <input style={inputStyle} value={form.cognome} onChange={(e) => set('cognome', e.target.value)} />
          </label>
          <label style={labelStyle}>Nome
            <input style={inputStyle} value={form.nome} onChange={(e) => set('nome', e.target.value)} />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
          <label style={labelStyle}>Data di nascita (GG/MM/AAAA)
            <input style={inputStyle} value={form.dataNascita} onChange={(e) => set('dataNascita', e.target.value)} placeholder="GG/MM/AAAA" />
          </label>
          <label style={labelStyle}>Luogo di nascita
            <input style={inputStyle} value={form.luogoNascita} onChange={(e) => set('luogoNascita', e.target.value)} />
          </label>
        </div>
        <label style={labelStyle}>Cittadinanza
          <input style={inputStyle} value={form.cittadinanza} onChange={(e) => set('cittadinanza', e.target.value)} placeholder="es. Italia" />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
          <label style={labelStyle}>Tipo documento
            <select style={inputStyle} value={form.tipoDocumento} onChange={(e) => set('tipoDocumento', e.target.value)}>
              {TIPI_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Numero documento
            <input style={inputStyle} value={form.numeroDocumento} onChange={(e) => set('numeroDocumento', e.target.value)} />
          </label>
        </div>
        <label style={labelStyle}>Rapporto con il capofamiglia
          <select style={inputStyle} value={form.rapporto} onChange={(e) => set('rapporto', e.target.value)}>
            <option value={RAPPORTO_CAPOFAMIGLIA}>{RAPPORTO_CAPOFAMIGLIA}</option>
            <option value={RAPPORTO_OSPITE}>{RAPPORTO_OSPITE}</option>
          </select>
        </label>

        {error && <p style={{ margin: 0, fontSize: '.78rem', color: '#c0392b' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '.4rem' }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ fontSize: '.8rem', padding: '.35rem .7rem' }}>
            Annulla
          </button>
          <button type="button" onClick={salva} disabled={saving} style={{ fontSize: '.8rem', padding: '.35rem .7rem', fontWeight: 600 }}>
            {saving ? 'Salvo…' : 'Salva schedina'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CardSchedina({ s, onSegnaInviato }: { s: Schedina; onSegnaInviato: (row: number) => void }) {
  const [copiato, setCopiato] = useState(false);
  const [marcando, setMarcando] = useState(false);

  async function copia() {
    try {
      await navigator.clipboard.writeText(formattaSchedinaPerCopia(s));
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      // clipboard non disponibile (es. contesto non sicuro) — l'operatore può ancora leggere e ricopiare a mano dal riquadro.
    }
  }

  async function segnaInviato() {
    setMarcando(true);
    try {
      await onSegnaInviato(s.row);
    } finally {
      setMarcando(false);
    }
  }

  return (
    <div style={{ background: 'var(--surface-soft)', borderRadius: 'var(--r-panel)', padding: '1rem 1.1rem', boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '.6rem', marginBottom: '.5rem' }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: '.95rem' }}>{s.cognome} {s.nome}</strong>
        <span className="badge warn">{s.stato}</span>
      </div>
      <pre style={{
        margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '.78rem',
        background: 'var(--surface)', borderRadius: '.4rem', padding: '.6rem .7rem', lineHeight: 1.5,
      }}>
        {formattaSchedinaPerCopia(s)}
      </pre>
      <div style={{ display: 'flex', gap: '.5rem', marginTop: '.7rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={copia} style={{ fontSize: '.78rem', padding: '.3rem .6rem', borderRadius: '.4rem', border: '1px solid var(--ink-faint, #ccc)', background: 'transparent', cursor: 'pointer' }}>
          {copiato ? '✓ Copiato' : '📋 Copia dati'}
        </button>
        <button type="button" onClick={segnaInviato} disabled={marcando} style={{ fontSize: '.78rem', padding: '.3rem .6rem', borderRadius: '.4rem', border: '1px solid var(--ink-faint, #ccc)', background: 'transparent', cursor: marcando ? 'wait' : 'pointer' }}>
          {marcando ? 'Aggiorno…' : '✓ Segna come inviato'}
        </button>
      </div>
    </div>
  );
}

export default function SchedineManager() {
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[] | null>(null);
  const [schedine, setSchedine] = useState<Schedina[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [formPer, setFormPer] = useState<Prenotazione | null>(null);

  function caricaSchedine() {
    fetch('/api/schedine')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) setSchedine(d.schedine);
        else setErrore((prev) => prev || d?.error || 'Errore sconosciuto nel caricamento delle schedine.');
      })
      .catch((e) => setErrore(String(e)));
  }

  useEffect(() => {
    fetch('/api/prenotazioni')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) setPrenotazioni(d.prenotazioni);
        else setErrore(d?.error || 'Errore sconosciuto nel caricamento delle prenotazioni.');
      })
      .catch((e) => setErrore(String(e)));
    caricaSchedine();
  }, []);

  const today = useMemo(() => todayMid(), []);
  const orizzonte = useMemo(() => new Date(today.getTime() + 3 * 86400000), [today]);

  const prenotazioniImminenti = useMemo(() => {
    if (!prenotazioni) return [];
    return prenotazioni
      .filter((p) => (p.stato || '').toLowerCase() === 'attiva')
      .map((p) => ({ p, ci: parseItDate(p.checkin) }))
      .filter((x): x is { p: Prenotazione; ci: Date } => !!x.ci && x.ci >= today && x.ci <= orizzonte)
      .sort((a, b) => a.ci.getTime() - b.ci.getTime())
      .map((x) => x.p);
  }, [prenotazioni, today, orizzonte]);

  const schedinePerPrenotazione = useMemo(() => {
    const mappa = new Map<string, Schedina[]>();
    for (const s of schedine ?? []) {
      const chiave = s.prenotazioneRow;
      if (!mappa.has(chiave)) mappa.set(chiave, []);
      mappa.get(chiave)!.push(s);
    }
    return mappa;
  }, [schedine]);

  const daInviare = useMemo(() => (schedine ?? []).filter((s) => s.stato === STATO_DA_INVIARE), [schedine]);

  async function segnaInviato(row: number) {
    const res = await fetch('/api/schedine', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row, stato: STATO_INVIATO_MANUALMENTE }),
    });
    const d = await res.json();
    if (d?.ok) {
      setSchedine((prev) => (prev ?? []).map((s) => (s.row === row ? { ...s, stato: STATO_INVIATO_MANUALMENTE } : s)));
    } else {
      setErrore(d?.error || 'Errore sconosciuto nell\'aggiornamento dello stato');
    }
  }

  return (
    <div className="panel full">
      <div style={{
        background: 'var(--warn-bg, #fff3cd)', color: 'var(--warn-ink, #7a5b00)',
        border: '1px solid var(--warn-ink, #a15c00)', borderRadius: '.5rem',
        padding: '.7rem .9rem', fontSize: '.82rem', fontWeight: 600, marginBottom: '1.1rem',
      }}>
        ⚠️ Questo strumento prepara i dati — l&apos;invio al Portale Alloggiati Web e a Sinfonia Turismo Smart resta manuale per ora, nessuna comunicazione automatica ai portali reali.
      </div>

      {errore && (
        <p style={{ color: '#c0392b', fontSize: '.82rem', marginTop: '-.4rem', marginBottom: '.9rem' }}>{errore}</p>
      )}

      <h3 style={{ fontSize: '1rem' }}>Check-in nei prossimi 3 giorni senza schedina</h3>
      {!prenotazioni && <p style={{ color: 'var(--ink-muted)' }}>Caricamento prenotazioni…</p>}
      {prenotazioni && prenotazioniImminenti.length === 0 && (
        <p style={{ color: 'var(--ink-muted)' }}>Nessun check-in nei prossimi 3 giorni.</p>
      )}
      <div style={{ display: 'grid', gap: '.8rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: '1.6rem' }}>
        {prenotazioniImminenti.map((p) => {
          const compilate = schedinePerPrenotazione.get(String(p.row)) ?? [];
          return (
            <div key={p.row} style={{ background: 'var(--surface-soft)', borderRadius: 'var(--r-panel)', padding: '1rem 1.1rem', boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '.6rem', marginBottom: '.4rem' }}>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{p.stanza}</strong>
                <span className={'badge ' + (compilate.length > 0 ? 'neutral' : 'urgent')}>
                  {compilate.length > 0 ? `${compilate.length} ospite/i compilati` : 'Nessuna schedina'}
                </span>
              </div>
              <p style={{ margin: '0 0 .7rem', fontSize: '.82rem', color: 'var(--ink-muted)' }}>
                {p.ospite} · {p.canale}<br />Check-in {p.checkin} → check-out {p.checkout}
              </p>
              <button
                type="button"
                onClick={() => setFormPer(p)}
                className="badge neutral"
                style={{ border: 'none', cursor: 'pointer' }}
              >
                + Compila schedina ospite
              </button>
            </div>
          );
        })}
      </div>

      <h3 style={{ fontSize: '1rem' }}>Schedine da inviare a mano ({daInviare.length})</h3>
      {!schedine && <p style={{ color: 'var(--ink-muted)' }}>Caricamento schedine…</p>}
      {schedine && daInviare.length === 0 && (
        <p style={{ color: 'var(--ink-muted)' }}>Nessuna schedina in attesa di invio.</p>
      )}
      <div style={{ display: 'grid', gap: '.8rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {daInviare.map((s) => (
          <CardSchedina key={s.row} s={s} onSegnaInviato={segnaInviato} />
        ))}
      </div>

      {formPer && (
        <FormOspite
          prenotazione={formPer}
          numeroOspiteGiaCompilati={(schedinePerPrenotazione.get(String(formPer.row)) ?? []).length}
          onClose={() => setFormPer(null)}
          onSaved={caricaSchedine}
        />
      )}

      <p style={{ color: 'var(--ink-faint)', fontSize: '.8rem', marginTop: '1.3rem' }}>
        I dati sono salvati sulla scheda &quot;SCHEDINE&quot; del foglio Google (stesso spreadsheet delle prenotazioni). Il pulsante &quot;Copia dati&quot; prepara un testo pronto da incollare a mano nel vero Portale Alloggiati Web; &quot;Segna come inviato&quot; aggiorna solo lo stato qui, non invia nulla.
      </p>
    </div>
  );
}
