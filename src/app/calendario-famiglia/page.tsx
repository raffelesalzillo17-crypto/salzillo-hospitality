'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Pagina pubblica di sola lettura per la famiglia di Raffaele: nessun login, protetta solo
// dal token nel link (?k=...). Mostra chi arriva/parte e il calendario a griglia — mai dati
// economici (lordo, utile, commissioni), quelli restano solo dentro /nuovo.
// Vedi src/app/api/calendario-famiglia/route.ts per il filtro lato server.

type Prenotazione = {
  id: string; checkin: string; checkout: string; ospite: string; telefono: string;
  alloggio: string; canale: string; numeroOspiti: number;
};
type Alloggio = { id: string; nome: string; emoji: string | null };

const CANALE_COLOR: Record<string, string> = {
  'Airbnb': '#FF5A5F', 'Booking': '#1D6DF0', 'Diretto': '#1FAA6E', 'No Tax': '#8C7BD8',
};
const dataIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const oggiISO = () => new Date().toISOString().slice(0, 10);

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

function Calendario({ prenotazioni, alloggi }: { prenotazioni: Prenotazione[]; alloggi: Alloggio[] }) {
  const [sel, setSel] = useState<Prenotazione | null>(null);
  const [meseOffset, setMeseOffset] = useState(0);
  const CELL = 40;
  const oggi = oggiISO();

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
          {alloggi.map((a) => (
            <CalRow key={a.id} alloggio={a} giorni={giorni} cell={CELL}
              prenotazioni={prenotazioni.filter((p) => p.alloggio === a.nome && p.checkout > primoGiorno && p.checkin <= ultimoGiorno)}
              onSel={setSel} />
          ))}
        </div>
      </div>
      <div className="callegend">
        {Object.entries(CANALE_COLOR).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}
      </div>

      {sel && (
        <div className="overlay" onClick={() => setSel(null)}>
          <div className="detail" onClick={(e) => e.stopPropagation()}>
            <button className="x" onClick={() => setSel(null)}>✕</button>
            <span className="eyebrow">{sel.alloggio}</span>
            <h2>{sel.ospite}</h2>
            <p className="sub">{dataIt(sel.checkin)} → {dataIt(sel.checkout)} · {sel.canale}</p>
            {sel.telefono && <p>📞 {sel.telefono}</p>}
            <p>👥 {sel.numeroOspiti} ospit{sel.numeroOspiti === 1 ? 'e' : 'i'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Agenda({ prenotazioni }: { prenotazioni: Prenotazione[] }) {
  const oggi = oggiISO();
  const fra7 = new Date(new Date(oggi).getTime() + 7 * 864e5).toISOString().slice(0, 10);
  const arrivi = prenotazioni.filter((p) => p.checkin >= oggi && p.checkin <= fra7).sort((a, b) => a.checkin.localeCompare(b.checkin));
  const partenze = prenotazioni.filter((p) => p.checkout >= oggi && p.checkout <= fra7).sort((a, b) => a.checkout.localeCompare(b.checkout));
  return (
    <div className="agendagrid">
      <div className="card">
        <h2>Arrivi — prossimi 7 giorni</h2>
        {arrivi.length === 0 && <p className="empty">Nessun arrivo previsto.</p>}
        {arrivi.map((p) => (
          <div key={p.id} className="agendarow">
            <span className="when">{dataIt(p.checkin)}</span>
            <span>{p.ospite}</span>
            <span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.alloggio}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Partenze — prossimi 7 giorni</h2>
        {partenze.length === 0 && <p className="empty">Nessuna partenza prevista.</p>}
        {partenze.map((p) => (
          <div key={p.id} className="agendarow">
            <span className="when">{dataIt(p.checkout)}</span>
            <span>{p.ospite}</span>
            <span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.alloggio}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Contenuto() {
  const params = useSearchParams();
  const k = params.get('k') ?? '';
  const [stato, setStato] = useState<'carico' | 'ok' | 'errore'>('carico');
  const [dati, setDati] = useState<{ alloggi: Alloggio[]; prenotazioni: Prenotazione[] } | null>(null);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    if (!k) { setStato('errore'); setErrore('Link incompleto.'); return; }
    fetch(`/api/calendario-famiglia?k=${encodeURIComponent(k)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) { setDati(d); setStato('ok'); } else { setErrore(d.error || 'Errore'); setStato('errore'); } })
      .catch((e) => { setErrore(String(e)); setStato('errore'); });
  }, [k]);

  if (stato === 'carico') return <div className="wrap"><p className="empty">Carico il calendario…</p></div>;
  if (stato === 'errore') return <div className="wrap"><div className="card"><h2>Non riesco ad aprire il calendario</h2><p>{errore}</p></div></div>;

  return (
    <div className="wrap">
      <h1>🌷 Salzillo Hospitality</h1>
      <p className="sub" style={{ marginTop: -8, marginBottom: 20 }}>Calendario prenotazioni — sola visualizzazione</p>
      <Agenda prenotazioni={dati!.prenotazioni} />
      <div style={{ height: 16 }} />
      <Calendario prenotazioni={dati!.prenotazioni} alloggi={dati!.alloggi} />
    </div>
  );
}

export default function CalendarioFamiglia() {
  return (
    <Suspense fallback={<div className="wrap"><p className="empty">Carico…</p></div>}>
      <Contenuto />
      <style>{CSS}</style>
    </Suspense>
  );
}

const CSS = `
:root{ --bg:#FAF7F3; --surface:#fff; --ink:#1C1C1E; --ink-muted:#6E6E73; --line:#EFEAE3; --coral:#FF5A5F; --coral-soft:#FFE7E4; }
@media (prefers-color-scheme: dark){ :root{ --bg:#161513; --surface:#211F1C; --ink:#F2EEE8; --ink-muted:#A8A29A; --line:#332F2A; --coral:#FF7A73; --coral-soft:#3A2420; } }
*{box-sizing:border-box;}
body{background:var(--bg);}
.wrap{min-height:100vh;width:100%;min-width:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:20px;max-width:1100px;margin:0 auto;}
h1{margin:0 0 4px;font-size:22px;}
h2{margin:0 0 10px;font-size:16px;}
.sub{color:var(--ink-muted);font-size:13px;}
.empty{color:var(--ink-muted);font-size:13px;}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:16px;min-width:0;}
.agendagrid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
@media (max-width:640px){.agendagrid{grid-template-columns:1fr;}}
.agendarow{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);font-size:13px;flex-wrap:wrap;}
.agendarow:last-child{border-bottom:none;}
.when{font-weight:700;color:var(--coral);min-width:64px;}
.chip{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-left:auto;}
.tablescroll{overflow-x:auto;}
.calhead{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.calhead h2{margin:0;text-transform:capitalize;}
.calhead button{width:32px;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:16px;cursor:pointer;}
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
.cal-cell{border-left:1px solid var(--line);height:100%;flex:none;position:relative;}
.cal-bar{position:absolute;top:7px;height:32px;border-radius:8px;border:none;color:#fff;font-size:11px;font-weight:700;padding:0 8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:flex;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:pointer;font-family:inherit;}
.cal-bar span{overflow:hidden;text-overflow:ellipsis;}
.callegend{display:flex;gap:14px;margin-top:12px;font-size:12px;flex-wrap:wrap;}
.callegend span{display:flex;align-items:center;gap:5px;}
.callegend i{width:12px;height:12px;border-radius:3px;display:inline-block;}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px;}
.detail{background:var(--surface);border-radius:16px;padding:20px;max-width:360px;width:100%;position:relative;}
.detail .x{position:absolute;top:12px;right:12px;background:none;border:none;font-size:16px;color:var(--ink-muted);cursor:pointer;}
.eyebrow{color:var(--coral);font-size:12px;font-weight:700;text-transform:uppercase;}
`;
