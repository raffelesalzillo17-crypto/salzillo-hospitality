'use client';

import { useEffect, useState } from 'react';
import { BANCHE_CONTO, type MovimentoConto } from '@/lib/conti';

// Registro conti bancari/investimento nel Patrimonio — dati persistiti sulla scheda "CONTI"
// del foglio Google via /api/conti. Vedi src/lib/conti.ts per il perché dell'inserimento
// MANUALE (nessuna connessione diretta alle banche, mai una password bancaria gestita qui).
//
// Nessun dato finto: se il registro è vuoto si mostra uno stato vuoto onesto, mai saldi
// di esempio. Raffaele inserisce lui i saldi reali quando li ha.

function eur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

type FormState = { banca: string; saldo: string; note: string };
const FORM_VUOTO: FormState = { banca: BANCHE_CONTO[0], saldo: '', note: '' };

export default function ContiBancari() {
  const [attuali, setAttuali] = useState<MovimentoConto[] | null>(null);
  const [totale, setTotale] = useState<number>(0);
  const [errore, setErrore] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(FORM_VUOTO);
  const [salvando, setSalvando] = useState(false);
  const [erroreForm, setErroreForm] = useState<string | null>(null);

  function carica() {
    setErrore(null);
    fetch('/api/conti')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) {
          setAttuali(d.attuali);
          setTotale(d.totale);
        } else setErrore(d?.error || 'Errore sconosciuto nel caricamento dei conti.');
      })
      .catch((e) => setErrore(String(e)));
  }

  useEffect(() => {
    carica();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErroreForm(null);

    if (!form.banca.trim()) {
      setErroreForm('La banca è obbligatoria.');
      return;
    }
    const saldoNum = Number(form.saldo.replace(',', '.'));
    if (!Number.isFinite(saldoNum)) {
      setErroreForm('Il saldo deve essere un numero (es. 1250.50).');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/conti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banca: form.banca.trim(), saldo: saldoNum, note: form.note.trim() }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d?.error || 'Errore sconosciuto nel salvataggio');
      setForm((f) => ({ ...FORM_VUOTO, banca: f.banca }));
      carica();
    } catch (err) {
      setErroreForm(err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="card row static">
        <div className="card-title"><span className="t">Conti bancari e investimento</span></div>

        {errore && (
          <p style={{ color: 'var(--warn-ink, #a15c00)' }}>Non riesco a leggere i conti al momento ({errore}). Riprova tra poco.</p>
        )}

        {!errore && attuali === null && (
          <p style={{ color: 'var(--ink-muted)' }}>Caricamento conti…</p>
        )}

        {!errore && attuali !== null && attuali.length === 0 && (
          <p style={{ color: 'var(--ink-muted)' }}>
            Nessun saldo inserito ancora — aggiungilo qui sotto quando ce l&apos;hai. Inserimento manuale per scelta: nessuna connessione diretta alle tue banche, mai una password gestita qui.
          </p>
        )}

        {!errore && attuali !== null && attuali.length > 0 && (
          <>
            <div className="stat-row">
              <div className="stat"><b className="num">{eur(totale)}</b><span>totale liquidità tracciata</span></div>
            </div>
            <ul className="mini-list" style={{ marginTop: '.8rem' }}>
              {attuali.map((m) => (
                <li key={m.banca}>
                  <span style={{ fontWeight: 700 }}>{m.banca}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.1rem' }}>
                    <b>{eur(m.saldo)}</b>
                    <span style={{ fontSize: '.72rem', color: 'var(--ink-faint)' }}>aggiornato il {m.data}{m.note ? ` · ${m.note}` : ''}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="card row static">
        <form onSubmit={handleSubmit}>
          <h4 style={{ fontSize: '.88rem', margin: '0 0 .8rem', fontWeight: 700 }}>Aggiorna un saldo</h4>
          <div style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)', flex: '0 0 180px' }}>
              Banca
              <select
                value={form.banca}
                onChange={(e) => setForm((f) => ({ ...f, banca: e.target.value }))}
                style={{ fontSize: '.88rem', padding: '.45rem .6rem', borderRadius: '.5rem', border: '1px solid var(--ink-faint)', background: 'var(--surface)' }}
              >
                {BANCHE_CONTO.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)', flex: '0 0 150px' }}>
              Saldo (€)
              <input
                type="text"
                inputMode="decimal"
                placeholder="Es: 1250.50"
                value={form.saldo}
                onChange={(e) => setForm((f) => ({ ...f, saldo: e.target.value }))}
                style={{ fontSize: '.88rem', padding: '.45rem .6rem', borderRadius: '.5rem', border: '1px solid var(--ink-faint)', background: 'var(--surface)' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)', flex: '1 1 200px' }}>
              Note (opzionale)
              <input
                type="text"
                placeholder="Es: dopo bonifico stipendio"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                style={{ fontSize: '.88rem', padding: '.45rem .6rem', borderRadius: '.5rem', border: '1px solid var(--ink-faint)', background: 'var(--surface)' }}
              />
            </label>
            <button
              type="submit"
              className="badge good"
              style={{ border: 'none', cursor: salvando ? 'wait' : 'pointer', padding: '.55rem 1rem', fontSize: '.82rem', minHeight: '2.5rem' }}
              disabled={salvando}
            >
              {salvando ? 'Salvo…' : 'Salva saldo'}
            </button>
          </div>
          {erroreForm && <p style={{ color: 'var(--urgent, #d5473c)', fontSize: '.8rem', marginTop: '.6rem' }}>{erroreForm}</p>}
        </form>
        <p style={{ color: 'var(--ink-faint)', fontSize: '.8rem', marginTop: '1rem' }}>
          Ogni salvataggio aggiunge una nuova riga allo storico (mai sovrascrive) — così restano tracciati anche i saldi passati, non solo l&apos;ultimo.
          Inserimento sempre manuale: nessuna app o servizio esterno legge le tue banche da qui.
        </p>
      </div>
    </>
  );
}
