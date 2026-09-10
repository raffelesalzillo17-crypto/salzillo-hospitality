'use client';

import { useEffect, useState } from 'react';

// Anagrafica ospiti — prima pietra dell'architettura pensata per durare (vedi
// wiki/decisioni/architettura-dati-pronta-per-server-domestico.md). Ogni ospite raccoglie i
// suoi soggiorni passati e i documenti collegati (contratto, ricevuta) in un unico posto,
// invece di prenotazioni isolate senza storia. Solo Raffaele, dentro Motore Rafilu.

type Ospite = {
  ospiteId: string;
  nome: string;
  telefono: string;
  codiceFiscale: string;
  note: string;
  creatoIl: string;
  aggiornatoIl: string;
};

type Soggiorno = { row: number; checkin: string; checkout: string; stanza: string; canale: string; lordo: number; stato: string };
type Documento = { id: string; nome: string; link: string };

function eur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export default function OspitiManager({ plancKey }: { plancKey: string }) {
  const [ospiti, setOspiti] = useState<Ospite[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');

  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [dettaglio, setDettaglio] = useState<{ ospite: Ospite; soggiorni: Soggiorno[]; documenti: Documento[] } | null>(null);
  const [erroreDettaglio, setErroreDettaglio] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ospiti', { headers: { 'x-plancia-key': plancKey } })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setOspiti(d.ospiti); else setErrore(d?.error || 'Errore sconosciuto'); })
      .catch((e) => setErrore(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selezionato) { setDettaglio(null); return; }
    setErroreDettaglio(null);
    setDettaglio(null);
    fetch(`/api/ospiti?id=${encodeURIComponent(selezionato)}`, { headers: { 'x-plancia-key': plancKey } })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setDettaglio(d); else setErroreDettaglio(d?.error || 'Errore sconosciuto'); })
      .catch((e) => setErroreDettaglio(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selezionato]);

  const filtrati = (ospiti ?? []).filter((o) =>
    !ricerca.trim() || o.nome.toLowerCase().includes(ricerca.trim().toLowerCase()) || o.telefono.includes(ricerca.trim())
  );

  if (selezionato) {
    return (
      <div className="detail-grid">
        <div className="panel">
          <button
            type="button"
            onClick={() => setSelezionato(null)}
            style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '.82rem', padding: 0, marginBottom: '.8rem' }}
          >
            ← Torna all&apos;elenco
          </button>

          {erroreDettaglio && <p style={{ color: 'var(--warn-ink, #a15c00)' }}>Non riesco a leggere i dettagli ({erroreDettaglio}).</p>}
          {!erroreDettaglio && !dettaglio && <p style={{ color: 'var(--ink-muted)' }}>Caricamento…</p>}

          {dettaglio && (
            <>
              <div className="card row static">
                <div className="card-title"><span className="t">{dettaglio.ospite.nome}</span></div>
                <p style={{ color: 'var(--ink-muted)', fontSize: '.85rem', margin: '.2rem 0 0' }}>
                  {dettaglio.ospite.telefono || 'nessun telefono registrato'}
                  {dettaglio.ospite.codiceFiscale ? ` · CF ${dettaglio.ospite.codiceFiscale}` : ''}
                </p>
              </div>

              <div className="card row static">
                <div className="card-title"><span className="t">Storico soggiorni ({dettaglio.soggiorni.length})</span></div>
                {dettaglio.soggiorni.length === 0 && <p style={{ color: 'var(--ink-muted)' }}>Nessun soggiorno trovato.</p>}
                {dettaglio.soggiorni.length > 0 && (
                  <ul className="mini-list" style={{ marginTop: '.4rem' }}>
                    {dettaglio.soggiorni.map((s) => (
                      <li key={s.row}>
                        <span>{s.stanza} · {s.checkin} → {s.checkout}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <b>{eur(s.lordo)}</b>
                          <span style={{ fontSize: '.72rem', color: 'var(--ink-faint)' }}>{s.canale} · {s.stato}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card row static">
                <div className="card-title"><span className="t">Documenti ({dettaglio.documenti.length})</span></div>
                {dettaglio.documenti.length === 0 && (
                  <p style={{ color: 'var(--ink-muted)' }}>
                    Nessun documento salvato — vengono agganciati automaticamente quando generi un contratto o una ricevuta per questo ospite (serve la cartella Drive configurata, vedi src/lib/documenti.ts).
                  </p>
                )}
                {dettaglio.documenti.length > 0 && (
                  <ul className="mini-list" style={{ marginTop: '.4rem' }}>
                    {dettaglio.documenti.map((d) => (
                      <li key={d.id}>
                        <span>{d.nome}</span>
                        {d.link && <a href={d.link} target="_blank" rel="noreferrer" style={{ color: 'var(--good, #1FAA6E)', fontSize: '.82rem' }}>Apri</a>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="detail-grid">
      <div className="panel">
        <div className="card row static">
          <div className="card-title"><span className="t">Ospiti</span></div>
          {errore && <p style={{ color: 'var(--warn-ink, #a15c00)' }}>Non riesco a leggere l&apos;anagrafica ({errore}).</p>}
          {!errore && ospiti === null && <p style={{ color: 'var(--ink-muted)' }}>Caricamento…</p>}
          {!errore && ospiti !== null && ospiti.length === 0 && (
            <p style={{ color: 'var(--ink-muted)' }}>Nessun ospite ancora — si popola da solo a ogni nuova prenotazione.</p>
          )}

          {!errore && ospiti !== null && ospiti.length > 0 && (
            <>
              <input
                type="text"
                placeholder="Cerca per nome o telefono…"
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                style={{ width: '100%', fontSize: '.88rem', padding: '.5rem .7rem', borderRadius: '.5rem', border: '1px solid var(--ink-faint)', background: 'var(--surface)', marginBottom: '.8rem', boxSizing: 'border-box' }}
              />
              <ul className="mini-list">
                {filtrati.map((o) => (
                  <li key={o.ospiteId} style={{ cursor: 'pointer' }} onClick={() => setSelezionato(o.ospiteId)}>
                    <span style={{ fontWeight: 700 }}>{o.nome}</span>
                    <span style={{ color: 'var(--ink-faint)', fontSize: '.8rem' }}>{o.telefono || '—'}</span>
                  </li>
                ))}
              </ul>
              {filtrati.length === 0 && <p style={{ color: 'var(--ink-muted)', fontSize: '.85rem' }}>Nessun risultato per &quot;{ricerca}&quot;.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
