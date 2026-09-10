'use client';

import { useEffect, useMemo, useState } from 'react';
import Sparkline from '@/components/Sparkline';
import { CATEGORIE_SPESA, STRUTTURE_SPESA, type Spesa } from '@/lib/spese';

// Stessa forma restituita da GET /api/prenotazioni (vedi src/app/api/prenotazioni/route.ts).
// lordo e utile sono già calcolati lato server (netto commissione OTA, cedolare secca 21%,
// pulizia fissa €20) — non ricalcolare quella logica qui.
type Prenotazione = {
  row: number;
  checkin: string;  // DD/MM/YYYY
  checkout: string;
  ospite: string;
  stanza: string;
  canale: string;
  lordo: number;
  utile: number;
  stato: string;
  penale: string;
  eventId: string;
  telefono: string;
};

const CANALI = ['Booking', 'Airbnb', 'Diretto', 'No Tax'];

function parseIt(data: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data.trim());
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function meseKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function meseLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function eur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function todayIt(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

type MeseAgg = { key: string; lordo: number; utile: number; count: number };

export default function ContabilitaDashboard() {
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[] | null>(null);
  const [erroreP, setErroreP] = useState<string | null>(null);
  const [spese, setSpese] = useState<Spesa[] | null>(null);
  const [erroreS, setErroreS] = useState<string | null>(null);

  const [form, setForm] = useState({
    data: todayIt(),
    categoria: CATEGORIE_SPESA[0] as string,
    categoriaAltro: '',
    descrizione: '',
    importo: '',
    struttura: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erroreForm, setErroreForm] = useState<string | null>(null);

  function caricaPrenotazioni() {
    fetch('/api/prenotazioni')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) setPrenotazioni(d.prenotazioni);
        else setErroreP(d?.error || 'Errore sconosciuto nel caricamento delle prenotazioni.');
      })
      .catch((e) => setErroreP(String(e)));
  }
  function caricaSpese() {
    fetch('/api/spese')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) setSpese(d.spese);
        else setErroreS(d?.error || 'Errore sconosciuto nel caricamento delle spese.');
      })
      .catch((e) => setErroreS(String(e)));
  }

  useEffect(() => {
    caricaPrenotazioni();
    caricaSpese();
  }, []);

  const oggi = useMemo(() => new Date(), []);
  const meseCorrenteKey = useMemo(() => meseKey(oggi), [oggi]);
  const mesePrecedenteKey = useMemo(() => meseKey(new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1)), [oggi]);

  // Solo prenotazioni non cancellate contano come entrate reali (stessa logica di src/app/page.tsx).
  const attive = useMemo(
    () => (prenotazioni ?? []).filter((p) => !p.stato.toLowerCase().includes('cancellat')),
    [prenotazioni]
  );

  const perMese = useMemo(() => {
    const mappa = new Map<string, MeseAgg>();
    for (const p of attive) {
      const d = parseIt(p.checkin);
      if (!d) continue;
      const key = meseKey(d);
      if (!mappa.has(key)) mappa.set(key, { key, lordo: 0, utile: 0, count: 0 });
      const agg = mappa.get(key)!;
      agg.lordo += p.lordo;
      agg.utile += p.utile;
      agg.count += 1;
    }
    return mappa;
  }, [attive]);

  const trend6 = useMemo(() => {
    return Array.from(perMese.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
  }, [perMese]);

  const meseCorrente = perMese.get(meseCorrenteKey) ?? { key: meseCorrenteKey, lordo: 0, utile: 0, count: 0 };
  const mesePrecedente = perMese.get(mesePrecedenteKey) ?? { key: mesePrecedenteKey, lordo: 0, utile: 0, count: 0 };

  const perCanaleMeseCorrente = useMemo(() => {
    const mappa = new Map<string, MeseAgg>();
    for (const p of attive) {
      const d = parseIt(p.checkin);
      if (!d || meseKey(d) !== meseCorrenteKey) continue;
      if (!mappa.has(p.canale)) mappa.set(p.canale, { key: p.canale, lordo: 0, utile: 0, count: 0 });
      const agg = mappa.get(p.canale)!;
      agg.lordo += p.lordo;
      agg.utile += p.utile;
      agg.count += 1;
    }
    return CANALI.map((c) => mappa.get(c)).filter((a): a is MeseAgg => !!a);
  }, [attive, meseCorrenteKey]);

  const speseMeseCorrente = useMemo(
    () => (spese ?? []).filter((s) => {
      const d = parseIt(s.data);
      return d && meseKey(d) === meseCorrenteKey;
    }),
    [spese, meseCorrenteKey]
  );
  const totaleSpeseMeseCorrente = useMemo(
    () => speseMeseCorrente.reduce((acc, s) => acc + s.importo, 0),
    [speseMeseCorrente]
  );

  const utileNettoReale = meseCorrente.utile - totaleSpeseMeseCorrente;

  const variazioneUtile = mesePrecedente.utile !== 0
    ? ((meseCorrente.utile - mesePrecedente.utile) / Math.abs(mesePrecedente.utile)) * 100
    : null;

  async function inviaSpesa(e: React.FormEvent) {
    e.preventDefault();
    setErroreForm(null);

    const categoriaFinale = form.categoria === 'Altro' && form.categoriaAltro.trim()
      ? form.categoriaAltro.trim()
      : form.categoria;

    const importoNum = Number(form.importo.replace(',', '.'));
    if (!Number.isFinite(importoNum) || importoNum <= 0) {
      setErroreForm('Importo non valido: inserisci un numero positivo.');
      return;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.data)) {
      setErroreForm('Data non valida: usa il formato GG/MM/AAAA.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/spese', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: form.data,
          categoria: categoriaFinale,
          descrizione: form.descrizione.trim(),
          importo: importoNum,
          struttura: form.struttura,
        }),
      });
      const d = await res.json();
      if (!d || !d.ok) throw new Error(d?.error || 'Errore sconosciuto nel salvataggio');

      setSpese((prev) => (prev ? [d.spesa, ...prev] : [d.spesa]));
      setForm({ data: todayIt(), categoria: CATEGORIE_SPESA[0], categoriaAltro: '', descrizione: '', importo: '', struttura: '' });
    } catch (err) {
      setErroreForm(err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  if (erroreP) {
    return (
      <div className="panel full">
        <h3>Contabilità</h3>
        <p style={{ color: 'var(--ink-muted)' }}>Non riesco a leggere le prenotazioni al momento ({erroreP}). Riprova tra poco.</p>
      </div>
    );
  }

  if (!prenotazioni) {
    return (
      <div className="panel full">
        <h3>Contabilità</h3>
        <p style={{ color: 'var(--ink-muted)' }}>Caricamento dati…</p>
      </div>
    );
  }

  return (
    <div className="detail-grid">
      <div className="panel full">
        <h3>Andamento — {meseLabel(meseCorrenteKey)} vs {meseLabel(mesePrecedenteKey)}</h3>
        {trend6.length > 1 && <Sparkline values={trend6.map((m) => m.utile)} height={80} />}
        {trend6.length <= 1 && (
          <p style={{ color: 'var(--ink-muted)', fontSize: '.85rem' }}>Servono almeno due mesi con prenotazioni per mostrare un andamento.</p>
        )}
        <div className="stat-row">
          <div className="stat">
            <b className="num">{eur(meseCorrente.lordo)}</b>
            <span>lordo — {meseLabel(meseCorrenteKey)} ({meseCorrente.count} prenotazioni)</span>
          </div>
          <div className="stat">
            <b className="num">{eur(meseCorrente.utile)}</b>
            <span>utile HostFlow — {meseLabel(meseCorrenteKey)}</span>
          </div>
          <div className="stat">
            <b className="num">{eur(mesePrecedente.utile)}</b>
            <span>utile HostFlow — {meseLabel(mesePrecedenteKey)} ({mesePrecedente.count} prenotazioni)</span>
          </div>
          {variazioneUtile != null && (
            <div className="stat">
              <b className="num" style={{ color: variazioneUtile >= 0 ? 'var(--good)' : 'var(--coral)' }}>
                {variazioneUtile >= 0 ? '+' : ''}{variazioneUtile.toFixed(0)}%
              </b>
              <span>variazione utile vs mese precedente</span>
            </div>
          )}
        </div>
        {trend6.length > 0 && (
          <p style={{ color: 'var(--ink-faint)', fontSize: '.78rem', marginTop: '.9rem' }}>
            Mesi mostrati (solo quelli con prenotazioni reali): {trend6.map((m) => meseLabel(m.key)).join(', ')}.
          </p>
        )}
      </div>

      <div className="card row static" style={{ gridColumn: '1 / -1' }}>
        <div className="card-title"><span className="t">Utile netto reale — {meseLabel(meseCorrenteKey)}</span></div>
        <div className="stat-row">
          <div className="stat">
            <b className="num">{eur(meseCorrente.utile)}</b>
            <span>utile da prenotazioni (HostFlow)</span>
          </div>
          <div className="stat">
            <b className="num" style={{ color: 'var(--coral)' }}>− {eur(totaleSpeseMeseCorrente)}</b>
            <span>spese extra registrate questo mese</span>
          </div>
          <div className="stat">
            <b className="num" style={{ color: utileNettoReale >= 0 ? 'var(--good)' : 'var(--coral)' }}>{eur(utileNettoReale)}</b>
            <span>utile netto reale</span>
          </div>
        </div>
        <p style={{ color: 'var(--ink-faint)', fontSize: '.78rem', marginTop: '.9rem' }}>
          HostFlow calcola l&apos;utile per singola prenotazione (netto commissione OTA, cedolare secca 21%, pulizia €20) ma non
          include le spese extra qui sotto (utenze, manutenzione, scorte...): questo è il totale più onesto.
        </p>
      </div>

      <div className="panel full">
        <h3>Per canale — {meseLabel(meseCorrenteKey)}</h3>
        {perCanaleMeseCorrente.length === 0 && (
          <p style={{ color: 'var(--ink-muted)' }}>Nessuna prenotazione questo mese.</p>
        )}
        {perCanaleMeseCorrente.length > 0 && (
          <div style={{ display: 'grid', gap: '.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {perCanaleMeseCorrente.map((c) => (
              <div key={c.key} style={{ background: 'var(--surface-soft)', borderRadius: 'var(--r-panel)', padding: '1rem 1.1rem' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '.5rem' }}>{c.key}</div>
                <div className="stat"><b className="num">{eur(c.lordo)}</b><span>lordo · {c.count} prenotazioni</span></div>
                <div className="stat" style={{ marginTop: '.4rem' }}><b className="num">{eur(c.utile)}</b><span>utile</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel full">
        <h3>Aggiungi spesa</h3>
        <form onSubmit={inviaSpesa} style={{ display: 'flex', flexWrap: 'wrap', gap: '.8rem', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)' }}>
            Data
            <input
              type="text"
              placeholder="GG/MM/AAAA"
              value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              style={{ padding: '.5rem .6rem', borderRadius: '.5rem', border: '1px solid var(--line)', width: '9rem' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)' }}>
            Categoria
            <select
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              style={{ padding: '.5rem .6rem', borderRadius: '.5rem', border: '1px solid var(--line)' }}
            >
              {CATEGORIE_SPESA.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {form.categoria === 'Altro' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)' }}>
              Specifica categoria
              <input
                type="text"
                placeholder="es. Assicurazione"
                value={form.categoriaAltro}
                onChange={(e) => setForm((f) => ({ ...f, categoriaAltro: e.target.value }))}
                style={{ padding: '.5rem .6rem', borderRadius: '.5rem', border: '1px solid var(--line)' }}
              />
            </label>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)', flex: '1 1 200px' }}>
            Descrizione
            <input
              type="text"
              placeholder="es. Bolletta luce Tulipano"
              value={form.descrizione}
              onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))}
              style={{ padding: '.5rem .6rem', borderRadius: '.5rem', border: '1px solid var(--line)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)' }}>
            Importo €
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={form.importo}
              onChange={(e) => setForm((f) => ({ ...f, importo: e.target.value }))}
              style={{ padding: '.5rem .6rem', borderRadius: '.5rem', border: '1px solid var(--line)', width: '7rem' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)' }}>
            Struttura (opzionale)
            <select
              value={form.struttura}
              onChange={(e) => setForm((f) => ({ ...f, struttura: e.target.value }))}
              style={{ padding: '.5rem .6rem', borderRadius: '.5rem', border: '1px solid var(--line)' }}
            >
              <option value="">—</option>
              {STRUTTURE_SPESA.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button
            type="submit"
            disabled={salvando}
            className="badge good"
            style={{ border: 'none', cursor: salvando ? 'wait' : 'pointer', fontSize: '.82rem', padding: '.55rem 1.1rem' }}
          >
            {salvando ? 'Salvo…' : 'Aggiungi spesa'}
          </button>
        </form>
        {erroreForm && <p style={{ color: 'var(--coral)', fontSize: '.82rem', marginTop: '.7rem' }}>{erroreForm}</p>}
      </div>

      <div className="panel full">
        <h3>Registro spese</h3>
        {erroreS && <p style={{ color: 'var(--coral)', fontSize: '.85rem' }}>Non riesco a leggere le spese al momento ({erroreS}).</p>}
        {!erroreS && spese == null && <p style={{ color: 'var(--ink-muted)' }}>Caricamento spese…</p>}
        {!erroreS && spese != null && spese.length === 0 && (
          <p style={{ color: 'var(--ink-muted)' }}>Nessuna spesa registrata.</p>
        )}
        {!erroreS && spese != null && spese.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--ink-muted)', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '.5rem .4rem' }}>Data</th>
                  <th style={{ padding: '.5rem .4rem' }}>Categoria</th>
                  <th style={{ padding: '.5rem .4rem' }}>Descrizione</th>
                  <th style={{ padding: '.5rem .4rem' }}>Struttura</th>
                  <th style={{ padding: '.5rem .4rem', textAlign: 'right' }}>Importo</th>
                </tr>
              </thead>
              <tbody>
                {spese.map((s) => (
                  <tr key={s.row} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '.5rem .4rem' }}>{s.data}</td>
                    <td style={{ padding: '.5rem .4rem' }}>{s.categoria}</td>
                    <td style={{ padding: '.5rem .4rem' }}>{s.descrizione || '—'}</td>
                    <td style={{ padding: '.5rem .4rem' }}>{s.struttura || '—'}</td>
                    <td style={{ padding: '.5rem .4rem', textAlign: 'right', fontWeight: 600 }}>{eur(s.importo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
