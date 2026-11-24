'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alloggio, Blocco, Dati, EventoLoc, LinkUtile, Operatore, Prenotazione, PrezzoPer, Pulizia } from '../tipi';
import { BottoneFatto } from './pulizie';
import { CANALE_COLOR, api, creaBlocco, dataIt, eur, mancanoDocumenti, rimuoviBloccoApi } from '../utilita';

export function SezioneCalendario({ dati, attive, oggi, onSel, puoModificare, titolare = false, onCambiato }: {
  dati: Dati; attive: Prenotazione[]; oggi: string; onSel: (p: Prenotazione) => void; puoModificare: boolean; titolare?: boolean; onCambiato: () => Promise<void>;
}) {
  const [sub, setSub] = useState<'griglia' | 'prezzi' | 'eventi'>('griglia');
  const eventi = (dati.eventi ?? []) as EventoLoc[];
  const prezzi = (dati.prezzi ?? []) as PrezzoPer[];
  const blocchi = (dati.blocchi ?? []) as Blocco[];
  const pulizie = (dati.pulizie ?? []) as Pulizia[];
  const operatoriPulizie = (dati.operatoriPulizie ?? []) as Operatore[];
  return (
    <>
      <div className="subtabs">
        {(['griglia', 'prezzi', 'eventi'] as const).map((s) => (
          <button key={s} className={sub === s ? 'on' : ''} onClick={() => setSub(s)}>
            {s === 'griglia' ? '📅 Calendario' : s === 'prezzi' ? `💶 Prezzi${prezzi.length ? ` (${prezzi.length})` : ''}` : `🎉 Eventi${eventi.length ? ` (${eventi.length})` : ''}`}
          </button>
        ))}
      </div>
      {sub === 'griglia' && <Calendario prenotazioni={attive} alloggi={dati.alloggi} oggi={oggi} onSel={onSel} eventi={eventi} prezzi={prezzi} blocchi={blocchi} pulizie={pulizie} operatoriPulizie={operatoriPulizie} puoModificare={puoModificare} onCambiato={onCambiato} conflitti={dati.conflittiCalendario ?? []} />}
      {sub === 'prezzi' && <PannelloPrezzi prezzi={prezzi} alloggi={dati.alloggi} eventi={eventi} puoModificare={titolare} onCambiato={onCambiato} />}
      {sub === 'eventi' && <PannelloEventi eventi={eventi} puoModificare={puoModificare} onCambiato={onCambiato} />}
    </>
  );
}

export function PannelloPrezzi({ prezzi, alloggi, eventi, puoModificare, onCambiato }: {
  prezzi: PrezzoPer[]; alloggi: Alloggio[]; eventi: EventoLoc[]; puoModificare: boolean; onCambiato: () => Promise<void>;
}) {
  const [f, setF] = useState({ alloggioId: '', dal: '', al: '', prezzoNotte: '', note: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function salva() {
    setBusy(true); setErr('');
    try {
      await api('crea-prezzo', { dati: { alloggioId: f.alloggioId || undefined, dal: f.dal, al: f.al || f.dal, prezzoNotte: Number(f.prezzoNotte), note: f.note || undefined } });
      setF({ alloggioId: '', dal: '', al: '', prezzoNotte: '', note: '' }); await onCambiato();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function rimuovi(id: string) { if (confirm('Rimuovere questo prezzo?')) { await api('cancella-prezzo', { id }); await onCambiato(); } }
  return (
    <div className="card">
      <h2>Prezzi consigliati per periodo</h2>
      <p className="empty" style={{ marginTop: -4 }}>Solo un promemoria per te quando fissi i prezzi su Airbnb/Booking o fai un preventivo. Non tocca le prenotazioni già fatte.</p>
      {puoModificare && (
        <div className="filtri" style={{ marginTop: 10 }}>
          <select value={f.alloggioId} onChange={(e) => setF({ ...f, alloggioId: e.target.value })}>
            <option value="">Tutti gli alloggi</option>
            {alloggi.filter((a) => a.attivo).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <input type="date" value={f.dal} onChange={(e) => setF({ ...f, dal: e.target.value })} title="dal" />
          <input type="date" value={f.al} onChange={(e) => setF({ ...f, al: e.target.value })} title="al" />
          <input type="number" step="0.01" placeholder="€/notte" value={f.prezzoNotte} onChange={(e) => setF({ ...f, prezzoNotte: e.target.value })} style={{ width: 100 }} />
          <input placeholder="nota (es. ponte, sagra)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <button className="add" disabled={busy || !f.dal || !f.prezzoNotte} onClick={salva}>＋ Aggiungi</button>
        </div>
      )}
      {err && <p className="err">{err}</p>}
      <div className="tablescroll">
        <table className="tbl full">
          <thead><tr><th>Periodo</th><th>Alloggio</th><th className="num">€/notte</th><th>Nota</th>{puoModificare && <th></th>}</tr></thead>
          <tbody>
            {prezzi.map((p) => {
              const ev = eventi.filter((e) => e.dal <= p.al && e.al >= p.dal);
              return (
                <tr key={p.id}>
                  <td>{dataIt(p.dal)} → {dataIt(p.al)}</td>
                  <td>{p.alloggio ?? 'Tutti'}</td>
                  <td className="num strong">{eur(Number(p.prezzoNotte))}</td>
                  <td>{p.note}{ev.length > 0 && <span className="empty"> · 🎉 {ev.map((e) => e.titolo).join(', ')}</span>}</td>
                  {puoModificare && <td><button className="mini" onClick={() => rimuovi(p.id)}>✕</button></td>}
                </tr>
              );
            })}
            {prezzi.length === 0 && <tr><td colSpan={puoModificare ? 5 : 4} className="empty">Nessun prezzo impostato.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PannelloEventi({ eventi, puoModificare, onCambiato }: {
  eventi: EventoLoc[]; puoModificare: boolean; onCambiato: () => Promise<void>;
}) {
  const [f, setF] = useState({ titolo: '', dal: '', al: '', comune: 'Marcianise', impatto: 'Medio', note: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function salva() {
    setBusy(true); setErr('');
    try {
      await api('crea-evento', { dati: { titolo: f.titolo, dal: f.dal, al: f.al || f.dal, comune: f.comune || undefined, impatto: f.impatto, note: f.note || undefined } });
      setF({ titolo: '', dal: '', al: '', comune: 'Marcianise', impatto: 'Medio', note: '' }); await onCambiato();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function rimuovi(id: string) { if (confirm('Rimuovere questo evento?')) { await api('cancella-evento', { id }); await onCambiato(); } }
  const imp: Record<string, string> = { Alto: '#E5484D', Medio: '#F5A623', Basso: '#8C7BD8' };
  return (
    <div className="card">
      <h2>Eventi in zona</h2>
      <p className="empty" style={{ marginTop: -4 }}>Sagre, fiere, concerti, ponti: sapere quando c&apos;è movimento in zona aiuta a decidere i prezzi.</p>
      {puoModificare && (
        <div className="filtri" style={{ marginTop: 10 }}>
          <input placeholder="Titolo (es. Fiera di San Simmaco)" value={f.titolo} onChange={(e) => setF({ ...f, titolo: e.target.value })} />
          <input type="date" value={f.dal} onChange={(e) => setF({ ...f, dal: e.target.value })} title="dal" />
          <input type="date" value={f.al} onChange={(e) => setF({ ...f, al: e.target.value })} title="al" />
          <input placeholder="comune" value={f.comune} onChange={(e) => setF({ ...f, comune: e.target.value })} style={{ width: 110 }} />
          <select value={f.impatto} onChange={(e) => setF({ ...f, impatto: e.target.value })}>
            {['Alto', 'Medio', 'Basso'].map((i) => <option key={i}>{i}</option>)}
          </select>
          <button className="add" disabled={busy || !f.titolo || !f.dal} onClick={salva}>＋ Aggiungi</button>
        </div>
      )}
      {err && <p className="err">{err}</p>}
      <div className="tablescroll">
        <table className="tbl full">
          <thead><tr><th>Evento</th><th>Quando</th><th>Comune</th><th>Impatto</th>{puoModificare && <th></th>}</tr></thead>
          <tbody>
            {eventi.map((e) => (
              <tr key={e.id}>
                <td><b>{e.titolo}</b>{e.note && <div className="empty">{e.note}</div>}</td>
                <td>{dataIt(e.dal)}{e.al !== e.dal ? ` → ${dataIt(e.al)}` : ''}</td>
                <td>{e.comune}</td>
                <td><span className="pill" style={{ background: (imp[e.impatto] || '#888') + '22', color: imp[e.impatto] || '#888' }}>{e.impatto}</span></td>
                {puoModificare && <td><button className="mini" onClick={() => rimuovi(e.id)}>✕</button></td>}
              </tr>
            ))}
            {eventi.length === 0 && <tr><td colSpan={puoModificare ? 5 : 4} className="empty">Nessun evento inserito.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Link utili ────────────────────────────────────────────────────────────────
export function LinkUtiliBox({ link, puoModificare, onCambiato }: {
  link: LinkUtile[]; puoModificare: boolean; onCambiato: () => Promise<void>;
}) {
  const [f, setF] = useState({ titolo: '', url: '', descrizione: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [copiato, setCopiato] = useState<string | null>(null);

  async function salva() {
    setBusy(true); setErr('');
    try {
      await api('crea-link-utile', { dati: { titolo: f.titolo, url: f.url, descrizione: f.descrizione || undefined, ordine: link.length } });
      setF({ titolo: '', url: '', descrizione: '' }); await onCambiato();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function rimuovi(id: string) { if (confirm('Rimuovere questo link?')) { await api('cancella-link-utile', { id }); await onCambiato(); } }
  async function copia(url: string) {
    try { await navigator.clipboard.writeText(url); setCopiato(url); setTimeout(() => setCopiato(null), 1500); } catch { /* niente, non blocca */ }
  }

  async function aggiungiLinkDiBase() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const base = [
      { titolo: 'Sito vetrina pubblico', url: `${origin}/soggiorna`, descrizione: 'Richieste dirette senza commissioni, tutte e 5 le camere' },
      { titolo: 'Pannello gestionale (questo)', url: `${origin}/nuovo`, descrizione: 'Prenotazioni, calendario, tutto il resto' },
      { titolo: 'Link ospite — Il Tulipano', url: `${origin}/checkin/tulipano-info.html`, descrizione: 'Un solo link da mandare all\'ospite: come arrivare, WiFi, regole, dove mangiare, cosa fare' },
      { titolo: 'Link ospite — Stanza Rosa', url: `${origin}/checkin/rosa-info.html`, descrizione: '' },
      { titolo: 'Link ospite — Piano Terra', url: `${origin}/checkin/piano-terra-info.html`, descrizione: '' },
      { titolo: 'Link ospite — Primo Piano', url: `${origin}/checkin/primo-piano-info.html`, descrizione: '' },
      { titolo: 'Link ospite — Secondo Piano', url: `${origin}/checkin/secondo-piano-info.html`, descrizione: '' },
      { titolo: 'WhatsApp Business Salzillo Hospitality', url: 'https://wa.me/393522203806', descrizione: 'Il numero ufficiale' },
    ];
    setBusy(true);
    try {
      for (let i = 0; i < base.length; i++) {
        await api('crea-link-utile', { dati: { ...base[i], descrizione: base[i].descrizione || undefined, ordine: i } });
      }
      await onCambiato();
    } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="cardhead"><h2>Link utili <small>({link.length})</small></h2></div>
      <p className="sub" style={{ marginTop: -4 }}>Una rubrica di link comodi da avere a portata di mano — anche da condividere. Tienila aggiornata tu: aggiungi qui gli annunci Airbnb e Booking o qualunque altro link che usi spesso.</p>
      {link.length === 0 && puoModificare && (
        <button className="add" disabled={busy} onClick={aggiungiLinkDiBase} style={{ marginBottom: 10 }}>✨ Aggiungi i link di base (sito, link ospite, WhatsApp)</button>
      )}
      {puoModificare && (
        <div className="filtri" style={{ marginTop: 10 }}>
          <input placeholder="Titolo (es. Annuncio Airbnb — Tulipano)" value={f.titolo} onChange={(e) => setF({ ...f, titolo: e.target.value })} />
          <input placeholder="https://..." value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} style={{ minWidth: 200 }} />
          <input placeholder="Descrizione (facoltativa)" value={f.descrizione} onChange={(e) => setF({ ...f, descrizione: e.target.value })} />
          <button className="add" disabled={busy || !f.titolo || !f.url} onClick={salva}>＋ Aggiungi</button>
        </div>
      )}
      {err && <p className="err">{err}</p>}
      {link.map((l) => (
        <div key={l.id} className="docrow">
          <b>{l.titolo}</b>
          <a href={l.url} target="_blank" rel="noopener" className="empty" style={{ wordBreak: 'break-all' }}>{l.url}</a>
          {l.descrizione && <span className="empty" style={{ flexBasis: '100%' }}>{l.descrizione}</span>}
          <span className="azioni">
            <button className="mini" onClick={() => copia(l.url)}>{copiato === l.url ? '✓ copiato' : '📋 copia'}</button>
            {puoModificare && <button className="mini" onClick={() => rimuovi(l.id)}>✕</button>}
          </span>
        </div>
      ))}
      {link.length === 0 && <p className="empty">Nessun link ancora — {puoModificare ? 'aggiungine uno o parti da quelli di base qui sopra.' : 'chiedi al titolare di aggiungerne.'}</p>}
    </div>
  );
}

// ── Calendario stile Airbnb (punto 8, 23/11/2026) ───────────────────────────
// Vista mese e vista settimana (la settimana parte dal lunedì), pulsante "Oggi", anteprima della prenotazione al passaggio del mouse e al
// tocco, selezione delle notti da bloccare con conferma (trascinando col mouse, o toccando primo e ultimo giorno sul telefono).

export type Anteprima = { p: Prenotazione; x: number; y: number };
export type ConflittoCal = { id: string; alloggio: string; prenotazioneId: string; motivo: string; calendario: string };

const addGiorni = (iso: string, n: number) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
/** Il lunedì della settimana che contiene la data. */
const lunedi = (iso: string) => addGiorni(iso, -((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7));

/** Stato del pagamento di una prenotazione, in parole. */
function statoPagamento(p: Prenotazione): { testo: string; colore: string } {
  if (p.canale === 'Airbnb' || p.canale === 'Booking') return { testo: `Pagamento tramite ${p.canale}`, colore: '#6E6E73' };
  const pagato = p.pagamenti.reduce((s, x) => s + (x.tipo === 'Rimborso' ? -x.importo : x.importo), 0);
  const residuo = Math.round((p.lordo - pagato) * 100) / 100;
  if (p.pagamenti.length === 0) return { testo: `Nessun pagamento (da incassare ${eur(p.lordo)})`, colore: '#E5484D' };
  if (residuo <= 0.5) return { testo: 'Saldato', colore: '#1FAA6E' };
  return { testo: `Pagato ${eur(pagato)}, da incassare ${eur(residuo)}`, colore: '#C97A16' };
}

export function Calendario({ prenotazioni, alloggi, oggi, onSel, eventi = [], prezzi = [], blocchi = [], pulizie = [], operatoriPulizie = [], puoModificare = false, onCambiato, conflitti = [] }: {
  prenotazioni: Prenotazione[]; alloggi: Alloggio[]; oggi: string; onSel: (p: Prenotazione) => void; eventi?: EventoLoc[]; prezzi?: PrezzoPer[];
  blocchi?: Blocco[]; pulizie?: Pulizia[]; operatoriPulizie?: Operatore[]; puoModificare?: boolean; onCambiato?: () => Promise<void>; conflitti?: ConflittoCal[];
}) {
  const [vista, setVista] = useState<'mese' | 'settimana'>(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'settimana' : 'mese'));
  const [offset, setOffset] = useState(0);
  const [larg, setLarg] = useState(0);
  const [largScorri, setLargScorri] = useState(0);
  const [anteprima, setAnteprima] = useState<Anteprima | null>(null);
  const [vaiOggi, setVaiOggi] = useState(0);
  const contRef = useRef<HTMLDivElement>(null);
  const scorrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contRef.current; const sc = scorrRef.current; if (!el || !sc) return;
    const ro = new ResizeObserver(() => { setLarg(el.clientWidth); setLargScorri(sc.clientWidth); });
    ro.observe(el); ro.observe(sc); setLarg(el.clientWidth); setLargScorri(sc.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { giorni, label } = useMemo(() => {
    if (vista === 'settimana') {
      const inizio = addGiorni(lunedi(oggi), offset * 7);
      const g = Array.from({ length: 7 }, (_, i) => addGiorni(inizio, i));
      return { giorni: g, label: `${dataIt(g[0])} – ${dataIt(g[6])}` };
    }
    const base = new Date(oggi); base.setDate(1); base.setMonth(base.getMonth() + offset);
    const anno = base.getFullYear(), mese = base.getMonth();
    const g: string[] = [];
    for (let d = 1; d <= new Date(anno, mese + 1, 0).getDate(); d++) g.push(`${anno}-${String(mese + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    return { giorni: g, label: base.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) };
  }, [oggi, offset, vista]);

  const stretto = larg > 0 && larg < 640;
  const fissa = stretto ? 84 : 160;
  // Settimana: i 7 giorni occupano esattamente la larghezza dell'area che scorre (misurata), quindi niente giorni tagliati nemmeno a 390 px.
  // Mese: celle da 40 px con scorrimento fluido.
  const CELL = vista === 'mese' ? 40 : Math.max(30, Math.floor((largScorri || 600) / 7));
  const primoGiorno = giorni[0], ultimoGiorno = giorni[giorni.length - 1];

  // "Oggi": torna al periodo corrente e porta il giorno di oggi al centro con uno scorrimento morbido
  useEffect(() => {
    const el = scorrRef.current; const i = giorni.indexOf(oggi);
    if (!el || i < 0) return;
    el.scrollTo({ left: Math.max(0, i * CELL - el.clientWidth / 2 + CELL / 2), behavior: vaiOggi ? 'smooth' : 'auto' });
  }, [vaiOggi, vista, offset, CELL]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!anteprima) return;
    const chiudi = () => setAnteprima(null);
    window.addEventListener('scroll', chiudi, true); document.addEventListener('click', chiudi);
    return () => { window.removeEventListener('scroll', chiudi, true); document.removeEventListener('click', chiudi); };
  }, [anteprima]);

  const conflittoIds = useMemo(() => new Set(conflitti.map((c) => c.prenotazioneId)), [conflitti]);
  const alloggiAttivi = alloggi.filter((a) => a.attivo);
  const ap = anteprima?.p;
  const pagamento = ap ? statoPagamento(ap) : null;

  return (
    <div className="card calwrap" ref={contRef}>
      {conflitti.length > 0 && (
        <div className="cal-avviso" role="alert">
          <b>⚠️ {conflitti.length === 1 ? 'Una sovrapposizione di calendario' : `${conflitti.length} sovrapposizioni di calendario`}</b>
          {conflitti.slice(0, 4).map((c) => <div key={c.id}><small><b>{c.alloggio}</b> · {c.motivo}</small></div>)}
          {conflitti.length > 4 && <small>…e altre {conflitti.length - 4} (vedi Dashboard)</small>}
        </div>
      )}
      <div className="calhead">
        <button onClick={() => setOffset((m) => m - 1)} aria-label={vista === 'mese' ? 'Mese precedente' : 'Settimana precedente'}>‹</button>
        <h2>{label}</h2>
        <button onClick={() => setOffset((m) => m + 1)} aria-label={vista === 'mese' ? 'Mese successivo' : 'Settimana successiva'}>›</button>
        <button className="oggi" onClick={() => { setOffset(0); setVaiOggi((n) => n + 1); }}>Oggi</button>
        <span className="calvista">
          <button className={vista === 'mese' ? 'on' : ''} onClick={() => { setVista('mese'); setOffset(0); }}>Mese</button>
          <button className={vista === 'settimana' ? 'on' : ''} onClick={() => { setVista('settimana'); setOffset(0); }}>Settimana</button>
        </span>
      </div>
      <div className="cal2col">
        <div className="cal-fixed" style={{ width: fissa }}>
          <div className="cal-corner" />
          {prezzi.length > 0 && <div className="cal-room cal-prezzo">💶 €/notte</div>}
          {alloggiAttivi.map((a) => <div key={a.id} className="cal-room">{a.emoji} {a.nome}</div>)}
        </div>
        <div className="tablescroll cal-scorri" ref={scorrRef}>
          <div className="cal" style={{ ['--cell' as string]: `${CELL}px`, gridTemplateColumns: `repeat(${giorni.length}, var(--cell))` }}>
            {giorni.map((g) => {
              const d = new Date(g);
              const we = d.getDay() === 0 || d.getDay() === 6;
              const ev = eventi.find((e) => e.dal <= g && e.al >= g);
              return <div key={g} className={'cal-day' + (we ? ' we' : '') + (d.getUTCDay() === 1 ? ' mon' : '') + (g === oggi ? ' today' : '') + (ev ? ' hasev' : '')} title={ev ? `🎉 ${ev.titolo}${ev.comune ? ' · ' + ev.comune : ''}` : undefined}>
                <small>{d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')}{ev ? '🎉' : ''}</small><span>{d.getDate()}</span>
              </div>;
            })}
            {prezzi.length > 0 && (
              <div className="cal-track" style={{ gridColumn: `1 / span ${giorni.length}`, height: 22 }}>
                {giorni.map((g) => {
                  const glob = prezzi.filter((p) => !p.alloggioId && p.dal <= g && p.al >= g).pop();
                  return <div key={g} className="cal-cell cal-prz" style={{ width: CELL }}>{glob ? Math.round(Number(glob.prezzoNotte)) : ''}</div>;
                })}
              </div>
            )}
            {alloggiAttivi.map((a) => (
              <CalRow key={a.id} giorni={giorni} cell={CELL} alloggioId={a.id} alloggioNome={a.nome}
                prenotazioni={prenotazioni.filter((p) => p.alloggio === a.nome && p.checkout > primoGiorno && p.checkin <= ultimoGiorno)}
                prezzi={prezzi.filter((p) => p.alloggioId === a.id)}
                blocchi={blocchi.filter((b) => b.alloggioId === a.id && b.checkout > primoGiorno && b.checkin <= ultimoGiorno)}
                pulizie={pulizie.filter((pu) => pu.alloggioId === a.id && pu.data >= primoGiorno && pu.data <= ultimoGiorno)}
                operatoriPulizie={operatoriPulizie}
                puoModificare={puoModificare} onCambiato={onCambiato}
                onSel={onSel} onAnteprima={setAnteprima} conflittoIds={conflittoIds} />
            ))}
          </div>
        </div>
      </div>
      {ap && anteprima && <div className="cal-veil" onClick={() => setAnteprima(null)} />}
      {ap && anteprima && (
        <div className="cal-anteprima" style={{ left: Math.min(Math.max(8, anteprima.x), (typeof window !== 'undefined' ? window.innerWidth : 900) - 268), top: anteprima.y }}
          onClick={(e) => e.stopPropagation()} onMouseLeave={() => setAnteprima(null)}>
          <button className="cal-chiudi" onClick={() => setAnteprima(null)} aria-label="Chiudi">✕</button>
          <b className="cal-ap-nome">{ap.ospite}</b>
          <div>{dataIt(ap.checkin)} → {dataIt(ap.checkout)} · {Math.max(1, Math.round((Date.parse(ap.checkout) - Date.parse(ap.checkin)) / 864e5))} nott{Math.round((Date.parse(ap.checkout) - Date.parse(ap.checkin)) / 864e5) === 1 ? 'e' : 'i'} · {ap.numeroOspiti} ospit{ap.numeroOspiti === 1 ? 'e' : 'i'}</div>
          <div><span className="chip" style={{ background: (CANALE_COLOR[ap.canale] || '#888') + '33', color: CANALE_COLOR[ap.canale] || '#888' }}>{ap.canale}</span> {ap.regimePrenotazione === 'No Tax' && <span className="chip" style={{ background: '#8C7BD833', color: '#8C7BD8' }}>🚫 No Tax: esente da ogni imposta</span>} {ap.regimePrenotazione === 'Esente da tassa di soggiorno' && <span className="chip" style={{ background: '#C97A1633', color: '#C97A16' }}>esente tassa di soggiorno</span>} {ap.stato !== 'Attiva' && <small>{ap.stato}</small>}</div>
          {pagamento && <div style={{ color: pagamento.colore, fontWeight: 700 }}>{pagamento.testo}</div>}
          {ap.daVerificare && <div style={{ color: '#8C7BD8' }}>⚠️ Da verificare: {ap.daVerificareMotivo ?? 'sparita dal calendario'}</div>}
          {conflittoIds.has(ap.id) && <div style={{ color: '#E5484D' }}>⚠️ Si sovrappone a un altro calendario</div>}
          {mancanoDocumenti(ap) && <div style={{ color: '#C97A16' }}>🪪 Mancano i documenti</div>}
          <button className="mini coral cal-ap-apri" onClick={() => { setAnteprima(null); onSel(ap); }}>Apri la scheda →</button>
        </div>
      )}
      <div className="callegend">
        {Object.entries(CANALE_COLOR).filter(([k]) => k !== 'No Tax').map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}
        <span><i style={{ background: '#1FAA6E', outline: '2px dashed #8C7BD8', outlineOffset: -2 }} />🚫 No Tax (esente da imposte)</span>
        <span><i style={{ background: 'repeating-linear-gradient(135deg,#888,#888 4px,#aaa 4px,#aaa 8px)' }} />Bloccato</span>
        <span><i style={{ background: 'var(--coral)', borderRadius: '50%' }} />Pulizia da fare (clicca per confermare)</span>
        <span><i style={{ background: '#1FAA6E', borderRadius: '50%', opacity: .75 }} />Pulizia fatta</span>
        {puoModificare && <span className="empty">— per bloccare delle notti: trascina su una riga vuota, oppure (da telefono) tocca il primo e l&apos;ultimo giorno; ti chiedo sempre conferma</span>}
      </div>
    </div>
  );
}

export function CalRow({ giorni, cell, alloggioId, alloggioNome, prenotazioni, prezzi = [], blocchi = [], pulizie = [], operatoriPulizie = [], puoModificare = false, onCambiato, onSel, onAnteprima = () => {}, conflittoIds = new Set<string>() }: {
  giorni: string[]; cell: number; alloggioId: string; alloggioNome: string; prenotazioni: Prenotazione[]; prezzi?: PrezzoPer[];
  blocchi?: Blocco[]; pulizie?: Pulizia[]; operatoriPulizie?: Operatore[]; puoModificare?: boolean; onCambiato?: () => Promise<void>; onSel: (p: Prenotazione) => void;
  onAnteprima?: (a: Anteprima | null) => void; conflittoIds?: Set<string>;
}) {
  const primo = giorni[0];
  const idx = (d: string) => Math.round((Date.parse(d) - Date.parse(primo)) / 864e5);
  const [drag, setDrag] = useState<{ start: number; end: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [puAperta, setPuAperta] = useState<string | null>(null);
  const [addettoSel, setAddettoSel] = useState('');

  const oggiLocale = new Date().toISOString().slice(0, 10);
  const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
  const [ancora, setAncora] = useState<number | null>(null);

  const occupato = (i: number) => {
    const g = giorni[i];
    return prenotazioni.some((p) => p.checkin <= g && p.checkout > g) || blocchi.some((b) => b.checkin <= g && b.checkout > g);
  };

  function iniziaSel(i: number) { if (coarse || !puoModificare || busy || occupato(i)) return; setDrag({ start: i, end: i }); }
  function estendiSel(i: number) { setDrag((d) => (d ? { ...d, end: i } : d)); }
  async function chiudiSel(d: { start: number; end: number } | null) {
    if (!d) return;
    const a = Math.min(d.start, d.end), b = Math.max(d.start, d.end);
    for (let i = a; i <= b; i++) if (occupato(i)) return; // qualcosa nel mezzo è occupato: annulla senza chiedere
    const checkin = giorni[a];
    const checkout = new Date(Date.parse(giorni[b]) + 864e5).toISOString().slice(0, 10);
    const notti = b - a + 1;
    if (!confirm(`Bloccare ${alloggioNome} dal ${dataIt(checkin)} al ${dataIt(checkout)} (${notti} nott${notti === 1 ? 'e' : 'i'})?`)) return;
    const nota = prompt('Nota (facoltativa) — es. manutenzione, uso personale:') ?? undefined;
    setBusy(true);
    try { await creaBlocco(alloggioId, checkin, checkout, nota || undefined); await onCambiato?.(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function sblocca(b: Blocco) {
    if (!puoModificare || busy) return;
    if (!confirm(`Sbloccare ${alloggioNome} dal ${dataIt(b.checkin)} al ${dataIt(b.checkout)}?${b.nota ? `\n${b.nota}` : ''}`)) return;
    setBusy(true);
    try { await rimuoviBloccoApi(b.id); await onCambiato?.(); }
    finally { setBusy(false); }
  }

  // Telefono e tablet: niente trascinamento (confligge con lo scorrimento): si tocca il primo giorno e poi l'ultimo; la conferma arriva sempre.
  function toccoCella(i: number) {
    if (!coarse || !puoModificare || busy || occupato(i)) return;
    if (ancora === null) { setAncora(i); return; }
    const d = { start: ancora, end: i };
    setAncora(null); chiudiSel(d);
  }
  function mostra(e: React.SyntheticEvent, p: Prenotazione) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onAnteprima({ p, x: r.left, y: r.bottom + 4 });
  }

  // Un listener globale, non solo sulla riga: se il rilascio del mouse avviene fuori dalla
  // riga (drag impreciso, o il dito scivola sul touch) la selezione va comunque chiusa,
  // altrimenti resta "incollata" senza modo di uscirne.
  useEffect(() => {
    if (!drag) return;
    const onUp = () => { const d = drag; setDrag(null); chiudiSel(d); };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [drag]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="cal-track" style={{ gridColumn: `1 / span ${giorni.length}`, userSelect: drag ? 'none' : undefined }}>
      {giorni.map((g, i) => {
        const pz = prezzi.filter((p) => p.dal <= g && p.al >= g).pop();
        const sel = (drag && i >= Math.min(drag.start, drag.end) && i <= Math.max(drag.start, drag.end)) || ancora === i;
        const cliccabile = puoModificare && !occupato(i);
        return (
          <div key={g} className={'cal-cell' + (sel ? ' selecting' : '') + (cliccabile ? ' selectable' : '') + (new Date(g).getUTCDay() === 1 ? ' mon' : '')} style={{ width: cell }}
            onMouseDown={() => iniziaSel(i)} onMouseEnter={() => estendiSel(i)} onClick={() => toccoCella(i)}>
            {pz && <span className="cal-przrow">{Math.round(Number(pz.prezzoNotte))}</span>}
          </div>
        );
      })}
      {ancora !== null && <div className="cal-hint">Tocca il giorno finale (o lo stesso giorno per una notte sola) · <button onClick={() => setAncora(null)}>annulla</button></div>}
      {blocchi.map((b) => {
        const start = Math.max(0, idx(b.checkin));
        const end = Math.min(giorni.length, idx(b.checkout));
        if (end <= start) return null;
        return (
          <button key={b.id} className="cal-bar blocco" onClick={() => sblocca(b)} disabled={!puoModificare || busy}
            style={{ left: start * cell + 4, width: (end - start) * cell - 8 }}
            title={`Bloccato · ${dataIt(b.checkin)}→${dataIt(b.checkout)}${b.nota ? ` · ${b.nota}` : ''}${puoModificare ? ' — clicca per sbloccare' : ''}`}>
            <span>🔒 {b.nota || 'Bloccato'}</span>
          </button>
        );
      })}
      {prenotazioni.map((p) => {
        const start = Math.max(0, idx(p.checkin));
        const end = Math.min(giorni.length, idx(p.checkout));
        if (end <= start) return null;
        const c = CANALE_COLOR[p.canale] || '#888';
        return (
          <button key={p.id} className="cal-bar" aria-label={`${p.ospite}, ${p.canale}, dal ${dataIt(p.checkin)} al ${dataIt(p.checkout)}`}
            onClick={(e) => { if (coarse) { e.stopPropagation(); mostra(e, p); } else onSel(p); }}
            onMouseEnter={(e) => { if (!coarse) mostra(e, p); }} onMouseLeave={() => { if (!coarse) onAnteprima(null); }}
            style={{ left: start * cell + 4, width: (end - start) * cell - 8, background: c, ...(p.regimePrenotazione === 'No Tax' ? { outline: '2px dashed #fff', outlineOffset: -3 } : {}) }}>
            <span>{(end - start) * cell - 8 >= 130 ? <>{p.regimePrenotazione === 'No Tax' ? '🚫 ' : ''}{p.daVerificare || conflittoIds.has(p.id) ? '⚠️ ' : ''}{mancanoDocumenti(p) ? '🪪 ' : ''}</> : null}{p.ospite}</span>
          </button>
        );
      })}
      {pulizie.map((pu) => {
        const i = idx(pu.data);
        if (i < 0 || i >= giorni.length) return null;
        const fatta = !!pu.confermataIl;
        return (
          <div key={pu.id} className="cal-pulizia-wrap" style={{ left: i * cell }}>
            <button type="button" className={'cal-pulizia-badge' + (fatta ? ' fatta' : '')}
              onClick={(e) => { e.stopPropagation(); setPuAperta(puAperta === pu.id ? null : pu.id); setAddettoSel(''); }}
              title={`Pulizia ${dataIt(pu.data)}${fatta ? ` — fatta${pu.addettoNome ? ` da ${pu.addettoNome}` : ''}` : ' — da fare, clicca per confermare'}`}>
              🧹
            </button>
            {puAperta === pu.id && (
              <div className="cal-pulizia-pop" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                {fatta ? (
                  <p className="empty">Fatta{pu.addettoNome ? ` da ${pu.addettoNome}` : ''} il {pu.confermataIl ? new Date(pu.confermataIl).toLocaleDateString('it-IT') : ''}.</p>
                ) : (
                  <>
                    {operatoriPulizie.length > 0 && (
                      <select value={addettoSel} onChange={(e) => setAddettoSel(e.target.value)}>
                        <option value="">chi ha pulito?</option>
                        {operatoriPulizie.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                      </select>
                    )}
                    {/* Punto 9: conferma a due passaggi, annullo per 10 secondi, mai prima del giorno del check-out (il server lo controlla comunque) */}
                    <BottoneFatto disabilitato={pu.data > oggiLocale} motivo={`da fare dal ${dataIt(pu.data)}`}
                      conferma={async () => { await api('conferma-pulizia', { id: pu.id, dati: { addettoId: addettoSel || undefined } }); }}
                      annulla={async () => { await api('annulla-pulizia', { id: pu.id }); }}
                      finito={async () => { setPuAperta(null); setAddettoSel(''); await onCambiato?.(); }} />
                  </>
                )}
                <button className="linklike" onClick={() => setPuAperta(null)}>chiudi</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
