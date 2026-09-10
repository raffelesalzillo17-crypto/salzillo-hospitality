'use client';

import { useEffect, useMemo, useState } from 'react';

/* Anteprima del NUOVO sistema Salzillo Hospitality (database).
   Non è ancora la fonte viva — Raffaele continua a usare il Google Sheet, che il database
   insegue via il cron /api/cron/sync-db. Qui si guarda com'è e si verifica che i dati
   tornino. Stessa identità visiva di Motore Rafilu (corallo→magenta).
   Vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md (fasi 4-5). */

type Prenotazione = {
  id: string; checkin: string; checkout: string; ospite: string; ospiteId: string; telefono: string;
  alloggio: string; immobile: string; proprietario: string; canale: string;
  lordo: number; commissione: number; cedolare: number; costoPulizia: number; feeGestione: number;
  utile: number; nettoProprietario: number; stato: string; penaleImporto: number | null; note: string;
};
type Alloggio = {
  id: string; nome: string; attivo: boolean; regimeFiscale: string; costoPulizia: string;
  emoji: string | null; wifiSsid: string | null; immobile: string; indirizzo: string;
  trasmetteAlloggiati: boolean; impostaSoggiornoComune: string | null;
};
type Ospite = { id: string; nome: string; cognome: string; telefono: string | null; email: string | null; valutazione: string; note: string | null };
type RigaMese = { immobile: string; proprietario: string; prenotazioni: number; lordo: number; utile: number; nettoProprietario: number };
type Anagrafica = { id: string; nome: string; immobili: { id: string; nome: string; comune: string; cin: string | null; alloggi: { id: string; nome: string; regime_fiscale: string }[] }[] }[];
type Dati = {
  ok: boolean; oggi: string; prenotazioni: Prenotazione[]; ospiti: Ospite[];
  anagrafica: Anagrafica; alloggi: Alloggio[]; spese: unknown[]; scadenze: unknown[]; riepilogoMese: RigaMese[];
};

const eur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const dataIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const CANALE_COLOR: Record<string, string> = {
  'Airbnb': '#FF5A5F', 'Booking': '#1D6DF0', 'Diretto': '#1FAA6E', 'No Tax': '#8C7BD8',
};

export default function Nuovo() {
  const [key, setKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [dati, setDati] = useState<Dati | null>(null);
  const [errore, setErrore] = useState('');
  const [tab, setTab] = useState<'dashboard' | 'calendario' | 'prenotazioni' | 'ospiti' | 'immobili'>('dashboard');
  const [prenSel, setPrenSel] = useState<Prenotazione | null>(null);

  useEffect(() => {
    let k = '';
    try { k = localStorage.getItem('plancia_key') || ''; } catch { /* */ }
    if (k) setKey(k);
  }, []);

  useEffect(() => {
    if (!key) return;
    setErrore('');
    fetch('/api/nuovo/dati', { headers: { 'x-plancia-key': key } })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setDati(d); else { setErrore(d.error || 'Errore'); setKey(''); } })
      .catch((e) => setErrore(String(e)));
  }, [key]);

  if (!key) {
    return (
      <div className="wrap gate">
        <style>{CSS}</style>
        <div className="card gatecard">
          <h1>Nuovo sistema · anteprima</h1>
          <p>Inserisci la chiave di Motore Rafilu.</p>
          <form onSubmit={(e) => { e.preventDefault(); const k = keyInput.trim(); if (k) { try { localStorage.setItem('plancia_key', k); } catch { /* */ } setKey(k); } }}>
            <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="chiave" autoFocus />
            <button type="submit">Entra</button>
          </form>
          {errore && <p className="err">{errore}</p>}
        </div>
      </div>
    );
  }

  if (!dati) {
    return <div className="wrap"><style>{CSS}</style><div className="card"><p>{errore || 'Carico i dati dal database…'}</p></div></div>;
  }

  const attive = dati.prenotazioni.filter((p) => p.stato === 'Attiva');
  const oggi = dati.oggi;
  const tra7 = new Date(Date.parse(oggi) + 7 * 864e5).toISOString().slice(0, 10);
  const arrivi = attive.filter((p) => p.checkin >= oggi && p.checkin <= tra7).sort((a, b) => a.checkin.localeCompare(b.checkin));
  const partenze = attive.filter((p) => p.checkout >= oggi && p.checkout <= tra7).sort((a, b) => a.checkout.localeCompare(b.checkout));
  const occupatiOggi = attive.filter((p) => p.checkin <= oggi && p.checkout > oggi);
  const meseNome = new Date(oggi).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const totMese = dati.riepilogoMese.reduce((s, r) => ({ lordo: s.lordo + r.lordo, utile: s.utile + r.utile, n: s.n + r.prenotazioni }), { lordo: 0, utile: 0, n: 0 });

  return (
    <div className="wrap">
      <style>{CSS}</style>

      <header className="topbar">
        <div>
          <span className="eyebrow">Salzillo Hospitality</span>
          <h1>Nuovo sistema <span className="beta">anteprima</span></h1>
        </div>
        <span className="hint">dati dal database · il foglio Google resta la fonte viva</span>
      </header>

      <nav className="tabs">
        {(['dashboard', 'calendario', 'prenotazioni', 'ospiti', 'immobili'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'dashboard' ? 'Dashboard' : t === 'calendario' ? 'Calendario' : t === 'prenotazioni' ? 'Prenotazioni' : t === 'ospiti' ? 'Ospiti' : 'Immobili'}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <div className="grid">
          <div className="card">
            <h2>Arrivi · prossimi 7 giorni</h2>
            {arrivi.length === 0 ? <p className="empty">Nessun arrivo.</p> : arrivi.map((p) => (
              <div key={p.id} className="row" onClick={() => setPrenSel(p)}>
                <b>{dataIt(p.checkin)}</b> <span>{p.ospite}</span>
                <span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.alloggio}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>Partenze · prossimi 7 giorni</h2>
            {partenze.length === 0 ? <p className="empty">Nessuna partenza.</p> : partenze.map((p) => (
              <div key={p.id} className="row" onClick={() => setPrenSel(p)}>
                <b>{dataIt(p.checkout)}</b> <span>{p.ospite}</span>
                <span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.alloggio}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>{meseNome} · per immobile</h2>
            <table className="tbl">
              <tbody>
                {dati.riepilogoMese.map((r) => (
                  <tr key={r.immobile}><td>{r.immobile}<small> · {r.proprietario}</small></td><td className="num">{r.prenotazioni}</td><td className="num">{eur(r.lordo)}</td><td className="num strong">{eur(r.utile)}</td></tr>
                ))}
                <tr className="tot"><td>Totale</td><td className="num">{totMese.n}</td><td className="num">{eur(totMese.lordo)}</td><td className="num strong">{eur(totMese.utile)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="card">
            <h2>Occupazione adesso</h2>
            <p className="big">{occupatiOggi.length} / {dati.alloggi.filter((a) => a.attivo).length} <small>alloggi occupati</small></p>
            {occupatiOggi.map((p) => (
              <div key={p.id} className="row" onClick={() => setPrenSel(p)}>
                <span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.alloggio}</span>
                <span>{p.ospite}</span> <small>fino al {dataIt(p.checkout)}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'calendario' && <Calendario prenotazioni={attive} alloggi={dati.alloggi} oggi={oggi} onSel={setPrenSel} />}

      {tab === 'prenotazioni' && (
        <div className="card">
          <h2>Prenotazioni <small>({dati.prenotazioni.length})</small></h2>
          <div className="tablescroll">
            <table className="tbl full">
              <thead><tr><th>Check-in</th><th>Check-out</th><th>Ospite</th><th>Alloggio</th><th>Canale</th><th className="num">Lordo</th><th className="num">Utile</th><th>Stato</th></tr></thead>
              <tbody>
                {dati.prenotazioni.map((p) => (
                  <tr key={p.id} onClick={() => setPrenSel(p)}>
                    <td>{dataIt(p.checkin)}</td><td>{dataIt(p.checkout)}</td><td>{p.ospite}</td><td>{p.alloggio}</td>
                    <td><span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.canale}</span></td>
                    <td className="num">{eur(p.lordo)}</td><td className="num strong">{eur(p.utile)}</td>
                    <td>{p.stato === 'Attiva' ? '✅' : '❌'} <small>{p.stato}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ospiti' && (
        <div className="card">
          <h2>Ospiti <small>({dati.ospiti.length})</small></h2>
          <div className="tablescroll">
            <table className="tbl full">
              <thead><tr><th>Cognome</th><th>Nome</th><th>Telefono</th><th>Email</th><th>Valutazione</th></tr></thead>
              <tbody>
                {dati.ospiti.map((o) => (
                  <tr key={o.id}><td>{o.cognome}</td><td>{o.nome}</td><td>{o.telefono || '—'}</td><td>{o.email || '—'}</td><td>{o.valutazione}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'immobili' && (
        <div className="grid">
          {dati.anagrafica.map((pr) => (
            <div key={pr.id} className="card">
              <h2>{pr.nome} <small>proprietario</small></h2>
              {pr.immobili.map((im) => (
                <div key={im.id} className="imm">
                  <h3>{im.nome} <small>· {im.comune}{im.cin ? ` · CIN ${im.cin}` : ''}</small></h3>
                  {im.alloggi.map((a) => (
                    <div key={a.id} className="row">
                      <b>{a.nome}</b>
                      <span className="chip" style={{ background: a.regime_fiscale === 'Con cedolare' ? '#1FAA6E22' : '#8C7BD822', color: a.regime_fiscale === 'Con cedolare' ? '#1FAA6E' : '#8C7BD8' }}>{a.regime_fiscale}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {prenSel && <DettaglioPrenotazione p={prenSel} onClose={() => setPrenSel(null)} />}
    </div>
  );
}

// ── Calendario stile Airbnb ─────────────────────────────────────────────────
function Calendario({ prenotazioni, alloggi, oggi, onSel }: {
  prenotazioni: Prenotazione[]; alloggi: Alloggio[]; oggi: string; onSel: (p: Prenotazione) => void;
}) {
  const [meseOffset, setMeseOffset] = useState(0);
  const CELL = 40; // px per giorno

  const { giorni, label } = useMemo(() => {
    const base = new Date(oggi);
    base.setDate(1);
    base.setMonth(base.getMonth() + meseOffset);
    const anno = base.getFullYear(), mese = base.getMonth();
    const nGiorni = new Date(anno, mese + 1, 0).getDate();
    const giorni: string[] = [];
    for (let d = 1; d <= nGiorni; d++) giorni.push(`${anno}-${String(mese + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    return { giorni, label: base.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) };
  }, [oggi, meseOffset]);

  const primoGiorno = giorni[0], ultimoGiorno = giorni[giorni.length - 1];

  return (
    <div className="card calwrap">
      <div className="calhead">
        <button onClick={() => setMeseOffset((m) => m - 1)}>‹</button>
        <h2>{label}</h2>
        <button onClick={() => setMeseOffset((m) => m + 1)}>›</button>
        {meseOffset !== 0 && <button className="oggi" onClick={() => setMeseOffset(0)}>oggi</button>}
      </div>
      <div className="tablescroll">
        <div className="cal" style={{ ['--cell' as string]: `${CELL}px`, gridTemplateColumns: `160px repeat(${giorni.length}, var(--cell))` }}>
          <div className="cal-corner" />
          {giorni.map((g) => {
            const d = new Date(g);
            const we = d.getDay() === 0 || d.getDay() === 6;
            return <div key={g} className={'cal-day' + (we ? ' we' : '') + (g === oggi ? ' today' : '')}>
              <span>{d.getDate()}</span><small>{d.toLocaleDateString('it-IT', { weekday: 'narrow' })}</small>
            </div>;
          })}
          {alloggi.filter((a) => a.attivo).map((a) => (
            <CalRow key={a.id} alloggio={a} giorni={giorni} cell={CELL}
              prenotazioni={prenotazioni.filter((p) => p.alloggio === a.nome && p.checkout > primoGiorno && p.checkin <= ultimoGiorno)}
              onSel={onSel} />
          ))}
        </div>
      </div>
      <div className="callegend">
        {Object.entries(CANALE_COLOR).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}
      </div>
    </div>
  );
}

function CalRow({ alloggio, giorni, cell, prenotazioni, onSel }: {
  alloggio: Alloggio; giorni: string[]; cell: number; prenotazioni: Prenotazione[]; onSel: (p: Prenotazione) => void;
}) {
  const primo = giorni[0];
  const idx = (d: string) => Math.round((Date.parse(d) - Date.parse(primo)) / 864e5);
  return (
    <>
      <div className="cal-room">{alloggio.emoji} {alloggio.nome}</div>
      <div className="cal-track" style={{ gridColumn: `2 / span ${giorni.length}` }}>
        {giorni.map((g) => <div key={g} className="cal-cell" style={{ width: cell }} />)}
        {prenotazioni.map((p) => {
          const start = Math.max(0, idx(p.checkin));
          const end = Math.min(giorni.length, idx(p.checkout));
          if (end <= start) return null;
          const c = CANALE_COLOR[p.canale] || '#888';
          return (
            <button key={p.id} className="cal-bar" onClick={() => onSel(p)}
              style={{ left: start * cell + 4, width: (end - start) * cell - 8, background: c }}
              title={`${p.ospite} · ${p.canale} · ${dataIt(p.checkin)}→${dataIt(p.checkout)}`}>
              <span>{p.ospite}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function DettaglioPrenotazione({ p, onClose }: { p: Prenotazione; onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>✕</button>
        <span className="eyebrow">{p.alloggio} · {p.immobile}</span>
        <h2>{p.ospite}</h2>
        <p className="sub">{dataIt(p.checkin)} → {dataIt(p.checkout)} · {p.canale} · {p.stato}</p>
        {p.telefono && <p>📞 {p.telefono}</p>}
        <table className="tbl">
          <tbody>
            <tr><td>Lordo</td><td className="num">{eur(p.lordo)}</td></tr>
            <tr><td>Commissione</td><td className="num">−{eur(p.commissione)}</td></tr>
            <tr><td>Cedolare</td><td className="num">−{eur(p.cedolare)}</td></tr>
            <tr><td>Pulizia</td><td className="num">−{eur(p.costoPulizia)}</td></tr>
            <tr><td>Fee gestione</td><td className="num">−{eur(p.feeGestione)}</td></tr>
            <tr className="tot"><td>Utile</td><td className="num strong">{eur(p.utile)}</td></tr>
            <tr><td>Netto proprietario</td><td className="num">{eur(p.nettoProprietario)}</td></tr>
          </tbody>
        </table>
        {p.penaleImporto != null && <p>Penale: {eur(p.penaleImporto)}</p>}
        {p.note && <p className="sub">{p.note}</p>}
      </div>
    </div>
  );
}

const CSS = `
:root{ --bg:#FAF7F3; --surface:#fff; --ink:#1C1C1E; --ink-muted:#6E6E73; --line:#EFEAE3;
  --coral:#FF5A5F; --coral-soft:#FFE7E4; }
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg:#161513; --surface:#211F1C; --ink:#F2EEE8; --ink-muted:#A8A29A; --line:#332F2A; --coral:#FF7A73; --coral-soft:#3A2420; } }
:root[data-theme="dark"]{ --bg:#161513; --surface:#211F1C; --ink:#F2EEE8; --ink-muted:#A8A29A; --line:#332F2A; --coral:#FF7A73; --coral-soft:#3A2420; }
*{box-sizing:border-box}
.wrap{min-height:100vh;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:20px;max-width:1200px;margin:0 auto;}
.gate{display:flex;align-items:center;justify-content:center;}
.gatecard{max-width:340px;text-align:center;}
.gatecard input{width:100%;padding:11px 14px;font-size:16px;border:1.5px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);margin:12px 0;}
.gatecard button,.gatecard input{font-family:inherit}
button{cursor:pointer;font-family:inherit}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:16px;}
.card h2{font-size:14px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:.05em;}
.card h2 small,h3 small{font-weight:400;text-transform:none;letter-spacing:0;color:var(--ink-muted);}
.topbar{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:8px;margin-bottom:16px;}
.eyebrow{font-size:11px;font-weight:800;color:var(--coral);text-transform:uppercase;letter-spacing:.1em;}
.topbar h1{font-size:24px;margin:2px 0 0;}
.beta{font-size:11px;font-weight:700;background:var(--coral-soft);color:var(--coral);padding:3px 8px;border-radius:100px;vertical-align:middle;}
.hint{font-size:12px;color:var(--ink-muted);}
.tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;}
.tabs button{padding:8px 14px;border:1px solid var(--line);background:var(--surface);color:var(--ink-muted);border-radius:100px;font-size:13px;font-weight:600;}
.tabs button.on{background:var(--coral);color:#fff;border-color:var(--coral);}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;}
.row{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line);font-size:14px;cursor:pointer;flex-wrap:wrap;}
.row:first-of-type{border-top:none;}
.row small{color:var(--ink-muted);}
.chip{font-size:11px;font-weight:700;padding:2px 8px;border-radius:100px;}
.empty,.sub{color:var(--ink-muted);font-size:13px;}
.big{font-size:28px;font-weight:800;margin:4px 0 12px;}
.big small{font-size:13px;font-weight:400;color:var(--ink-muted);}
.tbl{width:100%;border-collapse:collapse;font-size:13px;}
.tbl td,.tbl th{padding:7px 6px;border-top:1px solid var(--line);text-align:left;}
.tbl thead th{border-top:none;color:var(--ink-muted);font-weight:700;font-size:11px;text-transform:uppercase;}
.tbl .num{text-align:right;font-variant-numeric:tabular-nums;}
.tbl .strong{font-weight:800;}
.tbl tr.tot td{border-top:2px solid var(--ink);font-weight:800;}
.tbl.full tbody tr{cursor:pointer;}
.tbl.full tbody tr:hover{background:var(--coral-soft);}
.tbl td small{color:var(--ink-muted);}
.tablescroll{overflow-x:auto;}
.imm{margin-top:12px;}
.imm h3{font-size:13px;margin:0 0 6px;}
/* calendario */
.calhead{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.calhead h2{margin:0;text-transform:capitalize;}
.calhead button{width:32px;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:16px;}
.calhead button.oggi{width:auto;padding:0 12px;font-size:12px;font-weight:700;}
.cal{display:grid;position:relative;font-size:12px;}
.cal-corner{position:sticky;left:0;z-index:3;background:var(--surface);border-bottom:1px solid var(--line);}
.cal-day{text-align:center;padding:4px 0;border-bottom:1px solid var(--line);border-left:1px solid var(--line);display:flex;flex-direction:column;line-height:1.1;}
.cal-day.we{background:var(--coral-soft);}
.cal-day.today{background:var(--coral);color:#fff;font-weight:800;border-radius:6px 6px 0 0;}
.cal-day small{font-size:9px;color:var(--ink-muted);text-transform:uppercase;}
.cal-day.today small{color:#fff;}
.cal-room{position:sticky;left:0;z-index:2;background:var(--surface);font-weight:700;font-size:12px;padding:0 8px;display:flex;align-items:center;border-bottom:1px solid var(--line);border-right:1px solid var(--line);height:46px;}
.cal-track{position:relative;height:46px;border-bottom:1px solid var(--line);display:flex;}
.cal-cell{border-left:1px solid var(--line);height:100%;flex:none;}
.cal-bar{position:absolute;top:7px;height:32px;border-radius:8px;border:none;color:#fff;font-size:11px;font-weight:700;padding:0 8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:flex;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,.2);}
.cal-bar span{overflow:hidden;text-overflow:ellipsis;}
.callegend{display:flex;gap:14px;margin-top:12px;font-size:12px;flex-wrap:wrap;}
.callegend span{display:flex;align-items:center;gap:5px;}
.callegend i{width:12px;height:12px;border-radius:3px;display:inline-block;}
/* modale */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50;}
.modal{max-width:420px;width:100%;position:relative;}
.modal .x{position:absolute;top:12px;right:14px;border:none;background:none;font-size:16px;color:var(--ink-muted);}
.modal h2{font-size:20px;text-transform:none;letter-spacing:0;margin:4px 0;}
.err{color:#E5484D;font-size:13px;}
`;
