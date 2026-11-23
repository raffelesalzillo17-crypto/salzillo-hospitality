'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ArrivoAdempimento, Dati } from '../tipi';
import { dataIt, eur } from '../utilita';

// ── Dashboard (punto 7 delle richieste, 23/11/2026) ───────────────────────────────────────
// Riepilogo di tutti gli immobili con indicatori etichettati, e "Cosa manca" diviso in blocchi.
// Gli importi sono quelli dei Rendiconti dello stesso mese (prenotazioni con check-in nel mese).

type Riga = { immobileId: string; immobile: string; proprietario: string; alloggiAttivi: number; prenotazioni: number; lordo: number; commissioni: number; cedolare: number; pulizia: number; nettoProprietario: number; spese: number; nettoDopoSpese: number; tassaRiscossa: number; nottiOccupate: number; occupazione: number; nottiPrenotazioni: number; prezzoMedioNotte: number };
type Riepilogo = { anno: number; mese: number; immobili: Riga[]; totali: Omit<Riga, 'immobileId' | 'immobile' | 'proprietario'> };

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const pct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;

function Tessera({ etichetta, valore, nota, colore }: { etichetta: string; valore: string; nota: string; colore?: string }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', minWidth: 130, flex: '1 1 130px' }}>
      <small className="sub" style={{ display: 'block', fontWeight: 700 }}>{etichetta}</small>
      <div style={{ fontSize: 20, fontWeight: 800, color: colore }}>{valore}</div>
      <small className="sub" style={{ fontSize: 11, lineHeight: 1.2, display: 'block' }}>{nota}</small>
    </div>
  );
}

export function RiepilogoDashboard({ dati, oggi, ruoloTitolare }: { dati: Dati; oggi: string; ruoloTitolare: boolean }) {
  const [anno, setAnno] = useState(Number(oggi.slice(0, 4)));
  const [mese, setMese] = useState(Number(oggi.slice(5, 7)));
  const [prop, setProp] = useState('tutti');
  const [r, setR] = useState<Riepilogo | null>(null);
  const [fin, setFin] = useState(true);
  const [err, setErr] = useState('');

  const carica = useCallback(async () => {
    setErr('');
    try {
      const d = await (await fetch(`/api/nuovo/dashboard?parte=riepilogo&mese=${anno}-${String(mese).padStart(2, '0')}&proprietario=${prop}`)).json();
      if (!d.ok) throw new Error(d.error || 'Errore');
      setR(d.riepilogo); setFin(d.vedeFinanziario !== false);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, [anno, mese, prop]);
  useEffect(() => { carica(); }, [carica, dati.prenotazioni.length, dati.spese.length]);

  function sposta(d: number) { const t = new Date(anno, mese - 1 + d, 1); setAnno(t.getFullYear()); setMese(t.getMonth() + 1); }
  const t = r?.totali;

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="cardhead">
        <h2><i className="ic ic-mese">📊</i>Riepilogo di tutti gli immobili</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="mini" onClick={() => sposta(-1)} aria-label="Mese precedente">‹</button>
          <b style={{ textTransform: 'capitalize', minWidth: 110, textAlign: 'center' }}>{MESI[mese - 1]} {anno}</b>
          <button className="mini" onClick={() => sposta(1)} aria-label="Mese successivo">›</button>
          <button className="mini" onClick={() => { setAnno(Number(oggi.slice(0, 4))); setMese(Number(oggi.slice(5, 7))); }}>questo mese</button>
          {ruoloTitolare && dati.anagrafica.length > 1 && (
            <select value={prop} onChange={(e) => setProp(e.target.value)} aria-label="Proprietario">
              <option value="tutti">Tutti i proprietari</option>
              {dati.anagrafica.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      {!r || !t ? <p className="empty">Carico…</p> : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '6px 0 10px' }}>
            {fin && <>
              <Tessera etichetta="Incasso lordo" valore={eur(t.lordo)} nota={`${t.prenotazioni} prenotazioni con check-in nel mese`} />
              <Tessera etichetta="Commissioni OTA" valore={eur(t.commissioni)} nota="trattenute da Airbnb e Booking" colore="#E5484D" />
              <Tessera etichetta="Netto al proprietario" valore={eur(t.nettoProprietario)} nota="lordo meno commissioni, cedolare, pulizie e fee" colore="#1FAA6E" />
              <Tessera etichetta="Spese" valore={eur(t.spese)} nota="registrate nel mese sugli immobili" />
              <Tessera etichetta="Netto dopo le spese" valore={eur(t.nettoDopoSpese)} nota="netto al proprietario meno le spese" colore="#1FAA6E" />
              <Tessera etichetta="Tassa di soggiorno riscossa" valore={eur(t.tassaRiscossa)} nota="calcolata dalle prenotazioni (non è un incasso tuo)" />
            </>}
            <Tessera etichetta="Occupazione" valore={pct(t.occupazione)} nota={`${t.nottiOccupate} notti occupate su ${t.alloggiAttivi} alloggi attivi × giorni del mese`} />
            {fin && <Tessera etichetta="Prezzo medio a notte" valore={eur(t.prezzoMedioNotte)} nota="incasso lordo ÷ notti delle prenotazioni del mese" />}
          </div>
          <div className="tablescroll">
            <table className="tbl full" style={{ minWidth: 560 }}>
              <thead><tr><th>Immobile</th><th className="num">Prenot.</th>{fin && <><th className="num">Lordo</th><th className="num">Commissioni OTA</th><th className="num">Netto proprietario</th></>}<th className="num">Occupazione</th>{fin && <th className="num">€ a notte</th>}</tr></thead>
              <tbody>
                {r.immobili.map((i) => (
                  <tr key={i.immobileId}>
                    <td>{i.immobile}<small className="sub"> · {i.proprietario}</small></td><td className="num">{i.prenotazioni}</td>
                    {fin && <><td className="num">{eur(i.lordo)}</td><td className="num">{eur(i.commissioni)}</td><td className="num strong">{eur(i.nettoProprietario)}</td></>}
                    <td className="num">{pct(i.occupazione)}</td>{fin && <td className="num">{eur(i.prezzoMedioNotte)}</td>}
                  </tr>
                ))}
                {r.immobili.length === 0 && <tr><td colSpan={7} className="empty">Nessun immobile.</td></tr>}
                <tr className="tot"><td>Totale</td><td className="num">{t.prenotazioni}</td>{fin && <><td className="num">{eur(t.lordo)}</td><td className="num">{eur(t.commissioni)}</td><td className="num strong">{eur(t.nettoProprietario)}</td></>}<td className="num">{pct(t.occupazione)}</td>{fin && <td className="num">{eur(t.prezzoMedioNotte)}</td>}</tr>
              </tbody>
            </table>
          </div>
          <small className="sub">Gli importi sono gli stessi dei Rendiconti dello stesso mese (prenotazioni attive con check-in nel mese, tutti i canali).</small>
        </>
      )}
    </div>
  );
}

type Blocchi = {
  pagamenti: { id: string; ospite: string; alloggio: string; checkin: string; residuo: number }[];
  pulizie: { id: string; data: string; alloggio: string; urgente: boolean }[];
  scadenze: { id: string; titolo: string; data: string; immobile: string | null; scaduta: boolean }[];
  sovrapposizioni: { alloggio: string; testo: string }[];
  daVerificare: { id: string; alloggio: string; checkin: string; checkout: string; motivo: string }[];
  schedine: ArrivoAdempimento[];
};

function Blocco({ titolo, chip, colore, vuoto, children }: { titolo: string; chip: number; colore: string; vuoto: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 13, margin: '0 0 4px', display: 'flex', gap: 6, alignItems: 'center' }}>
        {titolo} <span className="chip" style={{ background: chip ? colore + '22' : '#8884', color: chip ? colore : '#6E6E73' }}>{chip}</span>
      </h3>
      {chip === 0 ? <small className="sub">{vuoto}</small> : children}
    </div>
  );
}

export function CosaManca({ dati, ruoloTitolare, onApriPrenotazione, onVai }: { dati: Dati; ruoloTitolare: boolean; onApriPrenotazione: (id: string) => void; onVai: (tab: string) => void }) {
  const [b, setB] = useState<Blocchi | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const d = await (await fetch('/api/nuovo/dashboard?parte=cosamanca')).json();
        if (!d.ok) throw new Error(d.error || 'Errore');
        setB(d);
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    })();
  }, [dati.prenotazioni.length, dati.pulizie?.length, dati.scadenze.length]);

  return (
    <div className="card">
      <h2><i className="ic ic-manca">📋</i>Cosa manca</h2>
      {err && <p className="err">{err}</p>}
      {!b ? <p className="empty">Carico…</p> : (
        <>
          <Blocco titolo="Pagamenti da incassare (prossimi 7 giorni)" chip={b.pagamenti.length} colore="#1D6DF0" vuoto="Nessun saldo in sospeso.">
            {b.pagamenti.map((p) => <div key={p.id} className="row" style={{ cursor: 'pointer' }} onClick={() => onApriPrenotazione(p.id)}>{p.ospite} <small>{p.alloggio} · arrivo {dataIt(p.checkin)}</small><b style={{ marginLeft: 'auto' }}>{eur(p.residuo)}</b></div>)}
          </Blocco>
          <Blocco titolo="Pulizie di oggi e domani" chip={b.pulizie.length} colore="#C97A16" vuoto="Nessuna pulizia da fare.">
            {b.pulizie.map((p) => <div key={p.id} className="row" style={{ cursor: 'pointer', ...(p.urgente ? { borderLeft: '3px solid #E5484D', paddingLeft: 6 } : {}) }} onClick={() => onVai('pulizie')}>{p.alloggio} <small>{dataIt(p.data)}</small>{p.urgente && <span className="chip" style={{ background: '#E5484D22', color: '#E5484D', fontWeight: 800 }}>⚡ urgente: arrivo lo stesso giorno</span>}</div>)}
          </Blocco>
          <Blocco titolo="Scadenze (prossimi 30 giorni e scadute)" chip={b.scadenze.length} colore="#8C7BD8" vuoto="Nessuna scadenza in arrivo.">
            {b.scadenze.map((s) => <div key={s.id} className="row" style={{ cursor: 'pointer' }} onClick={() => onVai('scadenze')}>{s.titolo} <small>{dataIt(s.data)}{s.immobile ? ` · ${s.immobile}` : ''}</small>{s.scaduta && <span className="chip" style={{ background: '#E5484D22', color: '#E5484D' }}>scaduta</span>}</div>)}
          </Blocco>
          {ruoloTitolare && (
            <Blocco titolo="Schedine mancanti o in ritardo" chip={b.schedine.length} colore="#E5484D" vuoto="Nessuna schedina in ritardo.">
              {b.schedine.map((x) => (
                <div key={x.prenotazioneId} className="row" style={{ cursor: 'pointer' }} onClick={() => onVai('adempimenti')}>
                  {x.alloggio} <small>arrivo {dataIt(x.checkin)} · {x.stato}{x.inRitardo ? ' · in ritardo' : ` · tra ${Math.max(0, Math.round(x.oreAllaScadenza))} ore`}{x.motivi[0] ? ` · ${x.motivi[0]}` : ''}</small>
                </div>
              ))}
            </Blocco>
          )}
          <Blocco titolo="Sovrapposizioni di calendario" chip={b.sovrapposizioni.length} colore="#E5484D" vuoto="Nessuna sovrapposizione.">
            {b.sovrapposizioni.map((s, i) => <div key={i} className="row" style={{ cursor: 'pointer' }} onClick={() => onVai('calendario')}><b>{s.alloggio}</b> <small>{s.testo}</small></div>)}
          </Blocco>
          <Blocco titolo="Prenotazioni da verificare" chip={b.daVerificare.length} colore="#8C7BD8" vuoto="Nessuna prenotazione sparita dai calendari.">
            {b.daVerificare.map((p) => <div key={p.id} className="row" style={{ cursor: 'pointer' }} onClick={() => onApriPrenotazione(p.id)}><b>{p.alloggio}</b> <small>{dataIt(p.checkin)}→{dataIt(p.checkout)} · {p.motivo}</small></div>)}
          </Blocco>
        </>
      )}
    </div>
  );
}
