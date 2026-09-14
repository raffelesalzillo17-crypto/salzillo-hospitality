'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Pagina di sola lettura per la famiglia di Raffaele: nessun login, protetta solo dal
// token nel link (?k=...). Mostra le stesse informazioni che vede Raffaele in /nuovo,
// dati economici e stato pulizie inclusi (richiesto esplicitamente) — sola visualizzazione,
// nessuna azione possibile da qui. Vedi src/app/api/calendario-famiglia/route.ts.

type Prenotazione = {
  id: string; checkin: string; checkout: string; ospite: string; telefono: string;
  alloggio: string; canale: string; numeroOspiti: number;
  lordo: number; commissione: number; cedolare: number; costoPulizia: number;
  feeGestione: number; utile: number; nettoProprietario: number;
};
type Alloggio = { id: string; nome: string; emoji: string | null };
type Pulizia = { id: string; data: string; alloggio: string; fatta: boolean };

const CANALE_COLOR: Record<string, string> = {
  'Airbnb': '#FF5A5F', 'Booking': '#1D6DF0', 'Diretto': '#1FAA6E', 'No Tax': '#8C7BD8',
};
const dataIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const oggiISO = () => new Date().toISOString().slice(0, 10);
const eur = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const neg = (n: number) => (n > 0 ? '-' : '') + eur(n);

function CalRow({ giorni, cell, prenotazioni, pulizie, onSel }: {
  giorni: string[]; cell: number; prenotazioni: Prenotazione[]; pulizie: Pulizia[]; onSel: (p: Prenotazione) => void;
}) {
  const primo = giorni[0];
  const idx = (d: string) => Math.round((Date.parse(d) - Date.parse(primo)) / 864e5);
  return (
    <div className="cal-track" style={{ gridColumn: `1 / span ${giorni.length}` }}>
      {giorni.map((g) => {
        const pul = pulizie.find((p) => p.data === g);
        return (
          <div key={g} className="cal-cell" style={{ width: cell }}>
            {pul && <span className="cal-puliz" title={pul.fatta ? 'Pulizia fatta' : 'Pulizia da fare'}>{pul.fatta ? '✅' : '🧹'}</span>}
          </div>
        );
      })}
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
  );
}

function Calendario({ prenotazioni, alloggi, pulizie }: { prenotazioni: Prenotazione[]; alloggi: Alloggio[]; pulizie: Pulizia[] }) {
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
  const alloggiAttivi = alloggi;

  return (
    <div className="card calwrap">
      <div className="calhead">
        <button onClick={() => setMeseOffset((m) => m - 1)}>‹</button>
        <h2>{label}</h2>
        <button onClick={() => setMeseOffset((m) => m + 1)}>›</button>
        {meseOffset !== 0 && <button className="oggi" onClick={() => setMeseOffset(0)}>oggi</button>}
      </div>
      {/* Colonna nomi stanza separata dalla griglia che scorre — vedi stessa soluzione in /nuovo:
          un figlio "sticky" dentro una CSS Grid resta ancorato alla propria colonna (che scorre),
          non alla pagina, quindi finiva per sparire scrollando. Qui invece è proprio fuori. */}
      <div className="cal2col">
        <div className="cal-fixed">
          <div className="cal-corner" />
          {alloggiAttivi.map((a) => <div key={a.id} className="cal-room">{a.emoji} {a.nome}</div>)}
        </div>
        <div className="tablescroll">
          <div className="cal" style={{ ['--cell' as string]: `${CELL}px`, gridTemplateColumns: `repeat(${giorni.length}, var(--cell))` }}>
            {giorni.map((g) => {
              const d = new Date(g);
              const we = d.getDay() === 0 || d.getDay() === 6;
              return <div key={g} className={'cal-day' + (we ? ' we' : '') + (g === oggi ? ' today' : '')}>
                <span>{d.getDate()}</span><small>{d.toLocaleDateString('it-IT', { weekday: 'narrow' })}</small>
              </div>;
            })}
            {alloggiAttivi.map((a) => (
              <CalRow key={a.id} giorni={giorni} cell={CELL}
                prenotazioni={prenotazioni.filter((p) => p.alloggio === a.nome && p.checkout > primoGiorno && p.checkin <= ultimoGiorno)}
                pulizie={pulizie.filter((p) => p.alloggio === a.nome && p.data >= primoGiorno && p.data <= ultimoGiorno)}
                onSel={setSel} />
            ))}
          </div>
        </div>
      </div>
      <div className="callegend">
        {Object.entries(CANALE_COLOR).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}
        <span>🧹 pulizia da fare</span>
        <span>✅ pulizia fatta</span>
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
            <table className="tbl"><tbody>
              <tr><td>Lordo</td><td className="num">{eur(sel.lordo)}</td></tr>
              {sel.commissione > 0 && <tr><td>Commissione</td><td className="num">{neg(sel.commissione)}</td></tr>}
              {sel.cedolare > 0 && <tr><td>Cedolare</td><td className="num">{neg(sel.cedolare)}</td></tr>}
              <tr><td>Pulizia</td><td className="num">{neg(sel.costoPulizia)}</td></tr>
              {sel.feeGestione > 0 && <tr><td>Fee gestione</td><td className="num">{neg(sel.feeGestione)}</td></tr>}
              <tr className="tot"><td>Utile</td><td className="num strong">{eur(sel.utile)}</td></tr>
              <tr><td>Netto proprietario</td><td className="num">{eur(sel.nettoProprietario)}</td></tr>
            </tbody></table>
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
  const [dati, setDati] = useState<{ alloggi: Alloggio[]; prenotazioni: Prenotazione[]; pulizie: Pulizia[] } | null>(null);
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
      <Calendario prenotazioni={dati!.prenotazioni} alloggi={dati!.alloggi} pulizie={dati!.pulizie} />
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
.cal2col{display:flex;align-items:flex-start;min-width:0;}
.cal-fixed{flex:none;width:160px;}
.cal{display:grid;position:relative;font-size:12px;}
.cal-corner{height:38px;background:var(--surface);border-bottom:1px solid var(--line);border-right:1px solid var(--line);}
.cal-day{text-align:center;padding:4px 0;height:38px;box-sizing:border-box;border-bottom:1px solid var(--line);border-left:1px solid var(--line);display:flex;flex-direction:column;justify-content:center;line-height:1.1;}
.cal-day.we{background:var(--coral-soft);}
.cal-day.today{background:var(--coral);color:#fff;font-weight:800;border-radius:6px 6px 0 0;}
.cal-day small{font-size:9px;color:var(--ink-muted);text-transform:uppercase;}
.cal-day.today small{color:#fff;}
.cal-room{background:var(--surface);font-weight:700;font-size:12px;padding:0 8px;display:flex;align-items:center;border-bottom:1px solid var(--line);border-right:1px solid var(--line);height:46px;}
.cal-track{position:relative;height:46px;border-bottom:1px solid var(--line);display:flex;}
.cal-cell{border-left:1px solid var(--line);height:100%;flex:none;position:relative;}
.cal-puliz{position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:11px;pointer-events:none;}
.cal-bar{position:absolute;top:7px;height:32px;border-radius:8px;border:none;color:#fff;font-size:11px;font-weight:700;padding:0 8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:flex;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:pointer;font-family:inherit;}
.cal-bar span{overflow:hidden;text-overflow:ellipsis;}
.callegend{display:flex;gap:14px;margin-top:12px;font-size:12px;flex-wrap:wrap;color:var(--ink-muted);}
.callegend span{display:flex;align-items:center;gap:5px;}
.callegend i{width:12px;height:12px;border-radius:3px;display:inline-block;}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px;}
.detail{background:var(--surface);border-radius:16px;padding:20px;max-width:360px;width:100%;position:relative;max-height:90vh;overflow-y:auto;}
.detail .x{position:absolute;top:12px;right:12px;background:none;border:none;font-size:16px;color:var(--ink-muted);cursor:pointer;}
.eyebrow{color:var(--coral);font-size:12px;font-weight:700;text-transform:uppercase;}
.tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;}
.tbl td{padding:4px 0;border-bottom:1px solid var(--line);}
.tbl td.num{text-align:right;font-variant-numeric:tabular-nums;}
.tbl tr.tot td{border-top:1px solid var(--line);border-bottom:none;padding-top:8px;}
.tbl td.strong{font-weight:800;}
`;
