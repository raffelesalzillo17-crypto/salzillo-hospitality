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
type AlloggioDb = {
  id: string; nome: string; regime_fiscale: string; costo_pulizia: string; attivo: boolean;
  emoji: string | null; wifi_ssid: string | null; wifi_password: string | null;
  trasmette_alloggiati: boolean; trasmette_regione: boolean;
  imposta_soggiorno_comune: string | null; imposta_soggiorno_importo: string;
};
type Anagrafica = {
  id: string; nome: string; email: string | null; telefono: string | null; iban: string | null;
  immobili: { id: string; nome: string; indirizzo: string; comune: string; provincia: string; cin: string | null; alloggi: AlloggioDb[] }[];
}[];
type Scadenza = { id: string; titolo: string; dataScadenza: string; ricorrenza: string; note: string | null; ultimoCompletamento: string | null; immobile: string | null };
type Spesa = { id: string; data: string; descrizione: string; importo: string; categoria: string; immobile: string | null; note: string | null };
type CosaManca = {
  schedineDaInviare: { id: string; cognome: string; nome: string; scadeIl: string | null; alloggio: string }[];
  scadenzeVicine: { id: string; titolo: string; dataScadenza: string; immobile: string | null }[];
  pulizieDaFare: { id: string; data: string; alloggio: string }[];
  pagamentiInSospeso: { id: string; ospite: string; checkin: string; lordo: string; alloggio: string }[];
};
type Dati = {
  ok: boolean; oggi: string; prenotazioni: Prenotazione[]; ospiti: Ospite[];
  anagrafica: Anagrafica; alloggi: Alloggio[]; spese: Spesa[]; scadenze: Scadenza[];
  riepilogoMese: RigaMese[]; cosaManca: CosaManca;
  categorieSpesa?: { id: string; nome: string }[];
};
type Rendiconto = {
  proprietario: string; anno: number; mese: number;
  righe: { id: string; checkin: string; checkout: string; alloggio: string; immobile: string; canale: string;
    ospite: string; lordo: string; commissione: string; cedolare: string; costoPulizia: string;
    feeGestione: string; utile: string; nettoProprietario: string }[];
  spese: { id: string; data: string; descrizione: string; importo: string; categoria: string; immobile: string }[];
  totali: { lordo: number; commissione: number; cedolare: number; costoPulizia: number; feeGestione: number;
    utile: number; nettoProprietario: number; totSpese: number; nettoFinale: number; impostaSoggiorno: number };
};

const eur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const dataIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const CANALE_COLOR: Record<string, string> = {
  'Airbnb': '#FF5A5F', 'Booking': '#1D6DF0', 'Diretto': '#1FAA6E', 'No Tax': '#8C7BD8',
};

type Campo = { k: string; label: string; tipo?: 'text' | 'number' | 'date' | 'select' | 'checkbox'; opzioni?: { v: string; t: string }[]; req?: boolean };

function FormModale({ titolo, campi, iniziali = {}, onInvia, onClose }: {
  titolo: string; campi: Campo[]; iniziali?: Record<string, unknown>;
  onInvia: (v: Record<string, unknown>) => Promise<void>; onClose: () => void;
}) {
  const [v, setV] = useState<Record<string, unknown>>(() => {
    const o: Record<string, unknown> = {};
    for (const c of campi) o[c.k] = iniziali[c.k] ?? (c.tipo === 'checkbox' ? false : c.tipo === 'number' ? '' : '');
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

async function api(azione: string, payload: Record<string, unknown> = {}) {
  const r = await fetch('/api/nuovo/scrivi', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ azione, ...payload }),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || 'Errore');
  return d.risultato;
}

export default function Nuovo() {
  const [sess, setSess] = useState<{ nome: string; ruolo: string; vedeFinanziario: boolean; puoModificare: boolean } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const [dati, setDati] = useState<Dati | null>(null);
  const [errore, setErrore] = useState('');
  const [tab, setTab] = useState<'dashboard' | 'calendario' | 'prenotazioni' | 'ospiti' | 'immobili' | 'spese' | 'scadenze' | 'rendiconti' | 'guida'>('dashboard');
  const [prenSel, setPrenSel] = useState<Prenotazione | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [nuovaPren, setNuovaPren] = useState(false);
  const [preventivo, setPreventivo] = useState(false);
  const [sinfoniaImm, setSinfoniaImm] = useState<string | null>(null);
  const [modale, setModale] = useState<null | { titolo: string; campi: Campo[]; azione: string; id?: string; iniziali?: Record<string, unknown> }>(null);

  async function inviaModale(vals: Record<string, unknown>) {
    if (!modale) return;
    await api(modale.azione, { id: modale.id, dati: vals });
    setModale(null);
    await carica();
  }

  async function carica() {
    const d = await (await fetch('/api/nuovo/dati')).json();
    if (d.ok) { setDati(d); setSess(d.sessione); } else setErrore(d.error || 'Errore');
  }

  useEffect(() => {
    fetch('/api/nuovo/dati').then((r) => r.json()).then((d) => {
      if (d.ok) { setDati(d); setSess(d.sessione); }
    }).finally(() => setAuthChecked(true));
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setErrore('');
    const r = await fetch('/api/nuovo/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
    const d = await r.json();
    if (d.ok) { setP(''); await carica(); } else setErrore(d.error || 'Errore');
  }
  async function logout() { await fetch('/api/nuovo/logout', { method: 'POST' }); setSess(null); setDati(null); }

  async function aggiorna() {
    setSyncing(true);
    try { await fetch('/api/nuovo/sync', { method: 'POST' }); await carica(); }
    catch { /* */ } finally { setSyncing(false); }
  }

  if (!authChecked) return <div className="wrap"><style>{CSS}</style><div className="card"><p>…</p></div></div>;

  if (!sess) {
    return (
      <div className="wrap gate">
        <style>{CSS}</style>
        <div className="card gatecard">
          <span className="eyebrow">Salzillo Hospitality</span>
          <h1>Nuovo sistema</h1>
          <form onSubmit={login}>
            <input value={u} onChange={(e) => setU(e.target.value)} placeholder="utente" autoFocus autoComplete="username" />
            <input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="password" autoComplete="current-password" />
            <button type="submit">Entra</button>
          </form>
          {errore && <p className="err">{errore}</p>}
        </div>
      </div>
    );
  }

  if (!dati) {
    return <div className="wrap"><style>{CSS}</style><div className="card"><p>{errore || 'Carico i dati…'}</p></div></div>;
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
        <div className="topright">
          <span className="hint">👤 {sess.nome} · <button className="linklike" onClick={logout}>esci</button></span>
          {sess.ruolo === 'Titolare' && <button className="sync" onClick={aggiorna} disabled={syncing}>{syncing ? 'aggiorno…' : '↻ aggiorna dal foglio'}</button>}
        </div>
      </header>

      <nav className="tabs">
        {(['dashboard', 'calendario', 'prenotazioni', 'ospiti', 'immobili', 'spese', 'scadenze', 'rendiconti', 'guida'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
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
          <div className="card">
            <h2>Cosa manca</h2>
            {(() => {
              const cm = dati.cosaManca;
              const vuoto = cm.schedineDaInviare.length + cm.scadenzeVicine.length + cm.pulizieDaFare.length + cm.pagamentiInSospeso.length === 0;
              if (vuoto) return <p className="empty">Tutto in ordine — niente in sospeso.</p>;
              return <>
                {cm.schedineDaInviare.map((s) => <div key={s.id} className="row"><span className="chip" style={{ background: '#E5484D22', color: '#E5484D' }}>schedina</span> {s.cognome} {s.nome} <small>{s.alloggio}{s.scadeIl ? ` · entro ${new Date(s.scadeIl).toLocaleString('it-IT')}` : ''}</small></div>)}
                {cm.pulizieDaFare.map((p) => <div key={p.id} className="row"><span className="chip" style={{ background: '#FFB23822', color: '#C97A16' }}>pulizia</span> {p.alloggio} <small>{dataIt(p.data)}</small></div>)}
                {cm.scadenzeVicine.map((s) => <div key={s.id} className="row"><span className="chip" style={{ background: '#8C7BD822', color: '#8C7BD8' }}>scadenza</span> {s.titolo} <small>{dataIt(s.dataScadenza)}{s.immobile ? ` · ${s.immobile}` : ''}</small></div>)}
                {cm.pagamentiInSospeso.map((p) => <div key={p.id} className="row"><span className="chip" style={{ background: '#1D6DF022', color: '#1D6DF0' }}>pagamento</span> {p.ospite} <small>{p.alloggio} · {dataIt(p.checkin)} · {eur(Number(p.lordo))}</small></div>)}
              </>;
            })()}
          </div>
        </div>
      )}

      {tab === 'rendiconti' && <Rendiconti anagrafica={dati.anagrafica} oggi={oggi} />}

      {tab === 'guida' && (
        <div className="grid">
          <div className="card">
            <h2>Come sono organizzati i dati</h2>
            <p className="sub" style={{ marginBottom: 14 }}>Tutto parte dal proprietario e scende fino alla singola prenotazione. Ogni cosa è collegata alla successiva — nessun numero da ricordare, si vedono sempre i nomi.</p>
            <div className="tree">
              <div className="tn tn0">👤 <b>Proprietario</b> <span>(Salzillo Luigi, Raffaela Iodice…)</span>
                <div className="tn tn1">🏠 <b>Immobile</b> <span>— un edificio con un indirizzo (Via Clanio 60, Via Campania 36)</span>
                  <div className="tn tn2">🚪 <b>Alloggio</b> <span>— la stanza/appartamento che affitti (Il Tulipano, Stanza Rosa…). Qui vivono: regime fiscale, costo pulizia, WiFi, se trasmette alle autorità, imposta di soggiorno</span>
                    <div className="tn tn3">📅 <b>Prenotazione</b> <span>— date, canale, prezzo. Il sistema calcola da solo commissione, cedolare, pulizia, utile, netto proprietario</span>
                      <div className="tn tn4">👥 <b>Ospite</b> — chi soggiorna (con storico di tutti i suoi soggiorni)</div>
                      <div className="tn tn4">💶 <b>Pagamenti</b> — caparra, saldo</div>
                      <div className="tn tn4">📋 <b>Schedina</b> — i dati per la Questura (Alloggiati Web)</div>
                      <div className="tn tn4">📄 <b>Documenti</b> — conferma, contratto, ricevuta salvati su Drive</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="sub" style={{ marginTop: 14 }}>A parte, non legati a una prenotazione: <b>Spese</b> (per immobile o generali), <b>Scadenze</b> (fiscali/amministrative), <b>Rendiconti</b> (uno per proprietario, per mese).</p>
          </div>
          <div className="card">
            <h2>Le sezioni di questa pagina</h2>
            <ul className="guidalist">
              <li><b>Dashboard</b> — il riepilogo del giorno: chi arriva/parte, soldi del mese, cosa manca, occupazione</li>
              <li><b>Calendario</b> — vista stile Airbnb: righe = alloggi, barre colorate = prenotazioni. Click su una barra → tutti i dettagli</li>
              <li><b>Prenotazioni</b> — l&apos;elenco completo. Da qui crei una prenotazione nuova o un preventivo</li>
              <li><b>Ospiti</b> — l&apos;anagrafica di chi ha soggiornato</li>
              <li><b>Immobili</b> — proprietari, immobili, alloggi. Da qui si aggiungono e si modificano</li>
              <li><b>Spese / Scadenze</b> — i costi e le scadenze da ricordare</li>
              <li><b>Rendiconti</b> — quanto spetta a ogni proprietario, con PDF pronto da mandare</li>
            </ul>
          </div>
          <div className="card">
            <h2>Dove sono i file</h2>
            <p className="sub">Su Google Drive, cartella <b>&quot;Archivio — Salzillo Hospitality&quot;</b>:</p>
            <div className="tree">
              <div className="tn tn0">📁 Archivio — Salzillo Hospitality
                <div className="tn tn1">📊 SH · Prenotazioni &amp; Ospiti <span>(il vecchio foglio, ancora la fonte viva)</span></div>
                <div className="tn tn1">📊 SH · Struttura &amp; Spese</div>
                <div className="tn tn1">📊 SH · Sistema</div>
                <div className="tn tn1">📁 Documenti Salzillo Hospitality <span>— una cartella per ospite, coi PDF</span></div>
              </div>
            </div>
            <p className="empty" style={{ marginTop: 12 }}>Quando il nuovo sistema sarà la fonte principale, i 3 fogli diventeranno un backup automatico settimanale e non si toccheranno più a mano.</p>
          </div>
        </div>
      )}

      {tab === 'calendario' && <Calendario prenotazioni={attive} alloggi={dati.alloggi} oggi={oggi} onSel={setPrenSel} />}

      {tab === 'prenotazioni' && (
        <div className="card">
          <div className="cardhead">
            <h2>Prenotazioni <small>({dati.prenotazioni.length})</small></h2>
            {sess.puoModificare && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="add" onClick={() => setPreventivo(true)}>📄 Preventivo</button>
              <button className="add" onClick={() => setNuovaPren(true)}>＋ Nuova prenotazione</button>
            </div>}
          </div>
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
          {sess.puoModificare && (
            <div className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="add" onClick={() => setModale({ titolo: 'Nuovo proprietario', azione: 'crea-proprietario', campi: [
                { k: 'nome', label: 'Nome', req: true },
                { k: 'tipo', label: 'Tipo', tipo: 'select', opzioni: [{ v: 'Persona fisica', t: 'Persona fisica' }, { v: 'Società', t: 'Società' }] },
                { k: 'codiceFiscalePiva', label: 'Codice fiscale / P.IVA' }, { k: 'email', label: 'Email' },
                { k: 'telefono', label: 'Telefono' }, { k: 'iban', label: 'IBAN (per i bonifici)' }, { k: 'note', label: 'Note' },
              ] })}>＋ Proprietario</button>
            </div>
          )}
          {dati.anagrafica.map((pr) => (
            <div key={pr.id} className="card">
              <div className="cardhead">
                <h2>{pr.nome} <small>proprietario</small></h2>
                {sess.puoModificare && <button className="add" onClick={() => setModale({ titolo: `Nuovo immobile di ${pr.nome}`, azione: 'crea-immobile', campi: [
                  { k: 'proprietarioId', label: 'Proprietario', tipo: 'select', opzioni: dati.anagrafica.map((x) => ({ v: x.id, t: x.nome })) },
                  { k: 'nome', label: 'Nome (es. Via Clanio 60)', req: true }, { k: 'indirizzo', label: 'Indirizzo', req: true },
                  { k: 'comune', label: 'Comune', req: true }, { k: 'provincia', label: 'Provincia', req: true },
                  { k: 'cin', label: 'CIN' }, { k: 'cir', label: 'CIR' },
                ], iniziali: { proprietarioId: pr.id, comune: 'Marcianise', provincia: 'CE' } })}>＋ Immobile</button>}
              </div>
              {pr.immobili.map((im) => (
                <div key={im.id} className="imm">
                  <div className="cardhead"><h3>{im.nome} <small>· {im.comune}{im.cin ? ` · CIN ${im.cin}` : ''}</small></h3>
                    {sess.ruolo === 'Titolare' && im.alloggi.some((a) => a.trasmette_regione) && <button className="add" onClick={() => setSinfoniaImm(im.id)}>Sinfonia</button>}
                    {sess.puoModificare && <button className="add" onClick={() => setModale({ titolo: `Nuovo alloggio in ${im.nome}`, azione: 'crea-alloggio', campi: [
                      { k: 'immobileId', label: 'Immobile', tipo: 'select', opzioni: pr.immobili.map((x) => ({ v: x.id, t: x.nome })) },
                      { k: 'nome', label: 'Nome (es. Il Tulipano)', req: true },
                      { k: 'regimeFiscale', label: 'Regime fiscale', tipo: 'select', opzioni: [{ v: 'No tax', t: 'No tax' }, { v: 'Con cedolare', t: 'Con cedolare' }] },
                      { k: 'costoPulizia', label: 'Costo pulizia €', tipo: 'number' },
                      { k: 'wifiSsid', label: 'WiFi rete' }, { k: 'wifiPassword', label: 'WiFi password' },
                      { k: 'trasmetteAlloggiati', label: 'Trasmette ad Alloggiati Web', tipo: 'checkbox' },
                      { k: 'trasmetteRegione', label: 'Trasmette al portale regionale (Sinfonia)', tipo: 'checkbox' },
                      { k: 'impostaSoggiornoComune', label: 'Imposta soggiorno — comune (vuoto = non dovuta)' },
                      { k: 'impostaSoggiornoImporto', label: 'Imposta soggiorno — € per persona/notte', tipo: 'number' },
                    ], iniziali: { immobileId: im.id, costoPulizia: 20 } })}>＋ Alloggio</button>}
                  </div>
                  {im.alloggi.map((a) => (
                    <div key={a.id} className="row" onClick={() => sess.puoModificare && setModale({ titolo: `Modifica ${a.nome}`, azione: 'aggiorna-alloggio', id: a.id, campi: [
                      { k: 'nome', label: 'Nome' },
                      { k: 'regimeFiscale', label: 'Regime fiscale', tipo: 'select', opzioni: [{ v: 'No tax', t: 'No tax' }, { v: 'Con cedolare', t: 'Con cedolare' }] },
                      { k: 'costoPulizia', label: 'Costo pulizia €', tipo: 'number' },
                      { k: 'attivo', label: 'Attivo', tipo: 'checkbox' },
                      { k: 'wifiSsid', label: 'WiFi rete' }, { k: 'wifiPassword', label: 'WiFi password' },
                      { k: 'trasmetteAlloggiati', label: 'Trasmette ad Alloggiati Web', tipo: 'checkbox' },
                      { k: 'trasmetteRegione', label: 'Trasmette al portale regionale', tipo: 'checkbox' },
                      { k: 'impostaSoggiornoComune', label: 'Imposta soggiorno — comune' },
                      { k: 'impostaSoggiornoImporto', label: 'Imposta soggiorno — €/persona/notte', tipo: 'number' },
                    ], iniziali: {
                      nome: a.nome, regimeFiscale: a.regime_fiscale, costoPulizia: a.costo_pulizia, attivo: a.attivo,
                      wifiSsid: a.wifi_ssid, wifiPassword: a.wifi_password, trasmetteAlloggiati: a.trasmette_alloggiati,
                      trasmetteRegione: a.trasmette_regione, impostaSoggiornoComune: a.imposta_soggiorno_comune,
                      impostaSoggiornoImporto: a.imposta_soggiorno_importo,
                    } })} style={{ cursor: sess.puoModificare ? 'pointer' : 'default' }}>
                      <b>{a.emoji} {a.nome}</b>
                      <span className="chip" style={{ background: a.regime_fiscale === 'Con cedolare' ? '#1FAA6E22' : '#8C7BD822', color: a.regime_fiscale === 'Con cedolare' ? '#1FAA6E' : '#8C7BD8' }}>{a.regime_fiscale}</span>
                      {a.imposta_soggiorno_comune && <small>tassa soggiorno {a.imposta_soggiorno_comune}</small>}
                      {!a.attivo && <small>non attivo</small>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'spese' && (
        <div className="card">
          <div className="cardhead">
            <h2>Spese <small>({dati.spese.length})</small></h2>
            {sess.puoModificare && <button className="add" onClick={() => setModale({ titolo: 'Nuova spesa', azione: 'crea-spesa', campi: [
              { k: 'data', label: 'Data', tipo: 'date', req: true },
              { k: 'categoriaId', label: 'Categoria', tipo: 'select', opzioni: (dati.categorieSpesa ?? []).map((c) => ({ v: c.id, t: c.nome })), req: true },
              { k: 'descrizione', label: 'Descrizione', req: true }, { k: 'importo', label: 'Importo €', tipo: 'number', req: true },
              { k: 'immobileId', label: 'Immobile (vuoto = spesa generale)', tipo: 'select', opzioni: [{ v: '', t: '— generale —' }, ...dati.anagrafica.flatMap((p) => p.immobili.map((i) => ({ v: i.id, t: i.nome })))] },
              { k: 'metodoPagamento', label: 'Metodo', tipo: 'select', opzioni: [{ v: '', t: '—' }, ...['Bonifico', 'Contanti', 'Carta', 'Piattaforma'].map((m) => ({ v: m, t: m }))] },
              { k: 'daRimborsareProprietario', label: 'Da rimborsare al proprietario', tipo: 'checkbox' },
              { k: 'note', label: 'Note' },
            ], iniziali: { data: oggi } })}>＋ Spesa</button>}
          </div>
          <div className="tablescroll"><table className="tbl full"><thead><tr><th>Data</th><th>Categoria</th><th>Descrizione</th><th>Immobile</th><th className="num">Importo</th></tr></thead>
            <tbody>{dati.spese.map((s) => <tr key={s.id}><td>{dataIt(s.data)}</td><td>{s.categoria}</td><td>{s.descrizione}</td><td>{s.immobile || 'generale'}</td><td className="num">{eur(Number(s.importo))}</td></tr>)}
            {dati.spese.length === 0 && <tr><td colSpan={5} className="empty">Nessuna spesa registrata.</td></tr>}</tbody></table></div>
        </div>
      )}

      {tab === 'scadenze' && (
        <div className="card">
          <div className="cardhead">
            <h2>Scadenze <small>({dati.scadenze.length})</small></h2>
            {sess.puoModificare && <button className="add" onClick={() => setModale({ titolo: 'Nuova scadenza', azione: 'crea-scadenza', campi: [
              { k: 'titolo', label: 'Titolo', req: true }, { k: 'dataScadenza', label: 'Data', tipo: 'date', req: true },
              { k: 'ricorrenza', label: 'Ricorrenza', tipo: 'select', opzioni: ['Una tantum', 'Mensile', 'Semestrale', 'Annuale'].map((r) => ({ v: r, t: r })) },
              { k: 'immobileId', label: 'Immobile (vuoto = generale)', tipo: 'select', opzioni: [{ v: '', t: '— generale —' }, ...dati.anagrafica.flatMap((p) => p.immobili.map((i) => ({ v: i.id, t: i.nome })))] },
              { k: 'note', label: 'Note' },
            ] })}>＋ Scadenza</button>}
          </div>
          <div className="tablescroll"><table className="tbl full"><thead><tr><th>Scadenza</th><th>Titolo</th><th>Ricorrenza</th><th>Immobile</th><th></th></tr></thead>
            <tbody>{dati.scadenze.map((s) => <tr key={s.id}><td>{dataIt(s.dataScadenza)}</td><td>{s.titolo}</td><td>{s.ricorrenza}</td><td>{s.immobile || 'generale'}</td>
              <td>{sess.puoModificare && <button className="danger" onClick={async () => { if (confirm('Segnare come fatta?')) { await api('completa-scadenza', { id: s.id }); await carica(); } }}>fatto</button>}</td></tr>)}
            {dati.scadenze.length === 0 && <tr><td colSpan={5} className="empty">Nessuna scadenza.</td></tr>}</tbody></table></div>
        </div>
      )}

      {prenSel && <DettaglioPrenotazione p={prenSel} alloggi={dati.alloggi} puoModificare={sess.puoModificare}
        onClose={() => setPrenSel(null)} onSalvato={async () => { setPrenSel(null); await carica(); }} />}
      {nuovaPren && <FormPrenotazione alloggi={dati.alloggi} ospiti={dati.ospiti}
        onClose={() => setNuovaPren(false)} onSalvato={async () => { setNuovaPren(false); await carica(); }} />}
      {modale && <FormModale titolo={modale.titolo} campi={modale.campi} iniziali={modale.iniziali}
        onInvia={inviaModale} onClose={() => setModale(null)} />}
      {preventivo && <Preventivo alloggi={dati.alloggi} onClose={() => setPreventivo(false)} />}
      {sinfoniaImm && <SinfoniaBox immobileId={sinfoniaImm} oggi={oggi} onClose={() => setSinfoniaImm(null)} />}
    </div>
  );
}

// ── Rendiconti proprietario ────────────────────────────────────────────────
function Rendiconti({ anagrafica, oggi }: { anagrafica: Anagrafica; oggi: string }) {
  const [propId, setPropId] = useState(anagrafica[0]?.id ?? '');
  const now = new Date(oggi);
  const [anno, setAnno] = useState(now.getFullYear());
  const [mese, setMese] = useState(now.getMonth() + 1);
  const [r, setR] = useState<Rendiconto | null>(null);
  const [caricando, setCaricando] = useState(false);

  useEffect(() => {
    if (!propId) return;
    setCaricando(true);
    fetch(`/api/nuovo/rendiconto?proprietario=${propId}&anno=${anno}&mese=${mese}`)
      .then((x) => x.json()).then((d) => setR(d.ok ? d.rendiconto : null)).finally(() => setCaricando(false));
  }, [propId, anno, mese]);

  const meseNome = new Date(anno, mese - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div className="card">
      <div className="rendctl">
        <select value={propId} onChange={(e) => setPropId(e.target.value)}>
          {anagrafica.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={mese} onChange={(e) => setMese(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i).toLocaleDateString('it-IT', { month: 'long' })}</option>)}
        </select>
        <select value={anno} onChange={(e) => setAnno(Number(e.target.value))}>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {caricando ? <p className="empty">Carico…</p> : !r ? <p className="empty">Nessun dato.</p> : (
        <>
          <h2>{r.proprietario} · <span style={{ textTransform: 'capitalize' }}>{meseNome}</span></h2>
          {r.righe.length === 0 ? <p className="empty">Nessuna prenotazione questo mese.</p> : (
            <div className="tablescroll">
              <table className="tbl full">
                <thead><tr><th>Check-in</th><th>Ospite</th><th>Alloggio</th><th>Canale</th><th className="num">Lordo</th><th className="num">Commiss.</th><th className="num">Cedolare</th><th className="num">Pulizia</th><th className="num">Fee</th><th className="num">Netto propr.</th></tr></thead>
                <tbody>
                  {r.righe.map((x) => (
                    <tr key={x.id}>
                      <td>{dataIt(x.checkin)}</td><td>{x.ospite}</td><td>{x.alloggio}</td><td>{x.canale}</td>
                      <td className="num">{eur(Number(x.lordo))}</td><td className="num">−{eur(Number(x.commissione))}</td>
                      <td className="num">−{eur(Number(x.cedolare))}</td><td className="num">−{eur(Number(x.costoPulizia))}</td>
                      <td className="num">−{eur(Number(x.feeGestione))}</td><td className="num strong">{eur(Number(x.nettoProprietario))}</td>
                    </tr>
                  ))}
                  <tr className="tot">
                    <td colSpan={4}>Totale prenotazioni ({r.righe.length})</td>
                    <td className="num">{eur(r.totali.lordo)}</td><td className="num">−{eur(r.totali.commissione)}</td>
                    <td className="num">−{eur(r.totali.cedolare)}</td><td className="num">−{eur(r.totali.costoPulizia)}</td>
                    <td className="num">−{eur(r.totali.feeGestione)}</td><td className="num strong">{eur(r.totali.nettoProprietario)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {r.spese.length > 0 && (
            <table className="tbl" style={{ marginTop: 16 }}>
              <thead><tr><th>Spese del mese</th><th></th><th className="num">Importo</th></tr></thead>
              <tbody>
                {r.spese.map((s) => <tr key={s.id}><td>{dataIt(s.data)} · {s.categoria}</td><td>{s.descrizione}</td><td className="num">−{eur(Number(s.importo))}</td></tr>)}
                <tr className="tot"><td colSpan={2}>Totale spese</td><td className="num">−{eur(r.totali.totSpese)}</td></tr>
              </tbody>
            </table>
          )}
          {r.totali.impostaSoggiorno > 0 && <p className="sub">Imposta di soggiorno incassata dagli ospiti (da versare al comune): {eur(r.totali.impostaSoggiorno)}</p>}
          <div className="rendtot">
            <span>Spetta al proprietario</span>
            <b>{eur(r.totali.nettoFinale)}</b>
          </div>
          <p style={{ marginTop: 12 }}>
            <a className="sync" href={`/api/nuovo/rendiconto/pdf?proprietario=${propId}&anno=${anno}&mese=${mese}`} target="_blank" rel="noopener" style={{ textDecoration: 'none', display: 'inline-block' }}>📄 Scarica il PDF</a>
          </p>
          <p className="empty" style={{ marginTop: 8 }}>Fee di gestione: 0% (immobile di famiglia).</p>
        </>
      )}
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

function DettaglioPrenotazione({ p, alloggi, puoModificare, onClose, onSalvato }: {
  p: Prenotazione; alloggi: Alloggio[]; puoModificare: boolean; onClose: () => void; onSalvato: () => void;
}) {
  const [modifica, setModifica] = useState(false);
  const [f, setF] = useState({ checkin: p.checkin, checkout: p.checkout, canale: p.canale, lordo: String(p.lordo), note: p.note, alloggioId: alloggi.find((a) => a.nome === p.alloggio)?.id ?? '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function salva() {
    setBusy(true); setErr('');
    try {
      await api('aggiorna-prenotazione', { id: p.id, dati: { checkin: f.checkin, checkout: f.checkout, canale: f.canale, lordo: Number(f.lordo), note: f.note, alloggioId: f.alloggioId } });
      onSalvato();
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  }
  async function cancella(conPenale: boolean) {
    if (!confirm(conPenale ? 'Cancellare CON penale?' : 'Cancellare questa prenotazione?')) return;
    setBusy(true);
    try {
      const imp = conPenale ? Number(prompt('Importo penale €:') || '0') : undefined;
      await api('cancella-prenotazione', { id: p.id, dati: { conPenale, importoPenale: imp } });
      onSalvato();
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>✕</button>
        <span className="eyebrow">{p.alloggio} · {p.immobile}</span>
        <h2>{p.ospite}</h2>

        {!modifica ? (
          <>
            <p className="sub">{dataIt(p.checkin)} → {dataIt(p.checkout)} · {p.canale} · {p.stato}</p>
            {p.telefono && <p>📞 {p.telefono}</p>}
            <table className="tbl"><tbody>
              <tr><td>Lordo</td><td className="num">{eur(p.lordo)}</td></tr>
              <tr><td>Commissione</td><td className="num">−{eur(p.commissione)}</td></tr>
              <tr><td>Cedolare</td><td className="num">−{eur(p.cedolare)}</td></tr>
              <tr><td>Pulizia</td><td className="num">−{eur(p.costoPulizia)}</td></tr>
              <tr><td>Fee gestione</td><td className="num">−{eur(p.feeGestione)}</td></tr>
              <tr className="tot"><td>Utile</td><td className="num strong">{eur(p.utile)}</td></tr>
              <tr><td>Netto proprietario</td><td className="num">{eur(p.nettoProprietario)}</td></tr>
            </tbody></table>
            {p.penaleImporto != null && <p>Penale: {eur(p.penaleImporto)}</p>}
            {p.note && <p className="sub">{p.note}</p>}
            <p style={{ marginTop: 10 }}>
              <a className="sync" href={`/api/nuovo/documento?tipo=conferma&prenotazione=${p.id}`} target="_blank" rel="noopener" style={{ textDecoration: 'none', display: 'inline-block' }}>📄 Conferma per l&apos;ospite</a>
            </p>
            {puoModificare && p.stato === 'Attiva' && (
              <div className="modalactions">
                <button className="add" onClick={() => setModifica(true)}>Modifica</button>
                <button className="danger" onClick={() => cancella(false)} disabled={busy}>Cancella</button>
                <button className="danger" onClick={() => cancella(true)} disabled={busy}>Cancella con penale</button>
              </div>
            )}
          </>
        ) : (
          <div className="form">
            <label>Alloggio<select value={f.alloggioId} onChange={(e) => setF({ ...f, alloggioId: e.target.value })}>{alloggi.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
            <label>Check-in<input type="date" value={f.checkin} onChange={(e) => setF({ ...f, checkin: e.target.value })} /></label>
            <label>Check-out<input type="date" value={f.checkout} onChange={(e) => setF({ ...f, checkout: e.target.value })} /></label>
            <label>Canale<select value={f.canale} onChange={(e) => setF({ ...f, canale: e.target.value })}>{['Airbnb', 'Booking', 'Diretto', 'No Tax'].map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Lordo €<input type="number" step="0.01" value={f.lordo} onChange={(e) => setF({ ...f, lordo: e.target.value })} /></label>
            <label>Note<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            <div className="modalactions">
              <button className="add" onClick={salva} disabled={busy}>{busy ? 'salvo…' : 'Salva'}</button>
              <button onClick={() => setModifica(false)}>Annulla</button>
            </div>
          </div>
        )}
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}

function FormPrenotazione({ alloggi, ospiti, onClose, onSalvato }: {
  alloggi: Alloggio[]; ospiti: Ospite[]; onClose: () => void; onSalvato: () => void;
}) {
  const [f, setF] = useState({
    alloggioId: alloggi[0]?.id ?? '', ospiteId: '', ospiteNome: '', ospiteCognome: '', ospiteTelefono: '',
    checkin: '', checkout: '', numeroOspiti: '1', canale: 'Diretto', lordo: '', codiceConfermaCanale: '', note: '',
  });
  const [anteprima, setAnteprima] = useState<{ utile: number; nettoProprietario: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const nuovoOspite = f.ospiteId === '';

  useEffect(() => {
    if (!f.alloggioId || !f.lordo) { setAnteprima(null); return; }
    api('anteprima-importi', { dati: { alloggioId: f.alloggioId, canale: f.canale, lordo: Number(f.lordo) } })
      .then((r) => setAnteprima(r as { utile: number; nettoProprietario: number })).catch(() => setAnteprima(null));
  }, [f.alloggioId, f.canale, f.lordo]);

  async function salva() {
    setBusy(true); setErr('');
    try {
      await api('crea-prenotazione', {
        dati: {
          alloggioId: f.alloggioId,
          ...(nuovoOspite ? { ospiteNome: f.ospiteNome, ospiteCognome: f.ospiteCognome, ospiteTelefono: f.ospiteTelefono } : { ospiteId: f.ospiteId }),
          checkin: f.checkin, checkout: f.checkout, numeroOspiti: Number(f.numeroOspiti),
          canale: f.canale, lordo: Number(f.lordo), codiceConfermaCanale: f.codiceConfermaCanale, note: f.note,
        },
      });
      onSalvato();
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>✕</button>
        <h2>Nuova prenotazione</h2>
        <div className="form">
          <label>Alloggio<select value={f.alloggioId} onChange={(e) => setF({ ...f, alloggioId: e.target.value })}>{alloggi.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
          <label>Ospite
            <select value={f.ospiteId} onChange={(e) => setF({ ...f, ospiteId: e.target.value })}>
              <option value="">— nuovo ospite —</option>
              {ospiti.map((o) => <option key={o.id} value={o.id}>{o.cognome} {o.nome}</option>)}
            </select>
          </label>
          {nuovoOspite && <>
            <label>Nome<input value={f.ospiteNome} onChange={(e) => setF({ ...f, ospiteNome: e.target.value })} /></label>
            <label>Cognome<input value={f.ospiteCognome} onChange={(e) => setF({ ...f, ospiteCognome: e.target.value })} /></label>
            <label>Telefono<input value={f.ospiteTelefono} onChange={(e) => setF({ ...f, ospiteTelefono: e.target.value })} /></label>
          </>}
          <label>Check-in<input type="date" value={f.checkin} onChange={(e) => setF({ ...f, checkin: e.target.value })} /></label>
          <label>Check-out<input type="date" value={f.checkout} onChange={(e) => setF({ ...f, checkout: e.target.value })} /></label>
          <label>Persone<input type="number" min="1" value={f.numeroOspiti} onChange={(e) => setF({ ...f, numeroOspiti: e.target.value })} /></label>
          <label>Canale<select value={f.canale} onChange={(e) => setF({ ...f, canale: e.target.value })}>{['Airbnb', 'Booking', 'Diretto', 'No Tax'].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Lordo €<input type="number" step="0.01" value={f.lordo} onChange={(e) => setF({ ...f, lordo: e.target.value })} /></label>
          <label>Codice conferma (Airbnb/Booking)<input value={f.codiceConfermaCanale} onChange={(e) => setF({ ...f, codiceConfermaCanale: e.target.value })} /></label>
          <label>Note<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        </div>
        {anteprima && <p className="sub">Utile stimato: <b>{eur(anteprima.utile)}</b> · netto proprietario: {eur(anteprima.nettoProprietario)}</p>}
        <div className="modalactions">
          <button className="add" onClick={salva} disabled={busy || !f.checkin || !f.checkout || !f.lordo || (nuovoOspite && (!f.ospiteNome || !f.ospiteCognome))}>{busy ? 'salvo…' : 'Crea'}</button>
          <button onClick={onClose}>Annulla</button>
        </div>
        {err && <p className="err">{err}</p>}
        <p className="empty" style={{ marginTop: 8 }}>Non crea l&apos;evento su Google Calendar (lo farà dopo il passaggio). Resta nel database anche dopo il sync col foglio.</p>
      </div>
    </div>
  );
}

function Preventivo({ alloggi, onClose }: { alloggi: Alloggio[]; onClose: () => void }) {
  const [f, setF] = useState({ alloggioId: alloggi[0]?.id ?? '', checkin: '', checkout: '', ospiti: '2', prezzo: '', cliente: '', note: '' });
  const url = `/api/nuovo/documento?tipo=preventivo&alloggio=${f.alloggioId}&checkin=${f.checkin}&checkout=${f.checkout}&ospiti=${f.ospiti}&prezzo=${f.prezzo}&cliente=${encodeURIComponent(f.cliente)}&note=${encodeURIComponent(f.note)}`;
  const pronto = f.alloggioId && f.checkin && f.checkout && f.prezzo;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>✕</button>
        <h2>Preventivo</h2>
        <div className="form">
          <label>Alloggio<select value={f.alloggioId} onChange={(e) => setF({ ...f, alloggioId: e.target.value })}>{alloggi.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
          <label>Check-in<input type="date" value={f.checkin} onChange={(e) => setF({ ...f, checkin: e.target.value })} /></label>
          <label>Check-out<input type="date" value={f.checkout} onChange={(e) => setF({ ...f, checkout: e.target.value })} /></label>
          <label>Ospiti<input type="number" min="1" value={f.ospiti} onChange={(e) => setF({ ...f, ospiti: e.target.value })} /></label>
          <label>Prezzo totale €<input type="number" step="0.01" value={f.prezzo} onChange={(e) => setF({ ...f, prezzo: e.target.value })} /></label>
          <label>Nome cliente<input value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} /></label>
          <label>Note<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        </div>
        <div className="modalactions">
          {pronto ? <a className="add" href={url} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>📄 Genera PDF</a> : <button className="add" disabled>Compila i campi</button>}
          <button onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>
  );
}

function SinfoniaBox({ immobileId, oggi, onClose }: { immobileId: string; oggi: string; onClose: () => void }) {
  const now = new Date(oggi);
  const [anno, setAnno] = useState(now.getFullYear());
  const [mese, setMese] = useState(now.getMonth() + 1);
  const [r, setR] = useState<{ contenuto: string; totaleArrivi: number; totalePartenze: number; avvisi: string[]; righe: unknown[] } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusy(true);
    fetch(`/api/nuovo/sinfonia?immobile=${immobileId}&anno=${anno}&mese=${mese}`)
      .then((x) => x.json()).then((d) => setR(d.ok ? d : null)).finally(() => setBusy(false));
  }, [immobileId, anno, mese]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>✕</button>
        <h2>File Sinfonia (portale regionale)</h2>
        <div className="rendctl">
          <select value={mese} onChange={(e) => setMese(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i).toLocaleDateString('it-IT', { month: 'long' })}</option>)}</select>
          <select value={anno} onChange={(e) => setAnno(Number(e.target.value))}>{[now.getFullYear() - 1, now.getFullYear()].map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </div>
        {busy ? <p className="empty">Genero…</p> : !r ? <p className="err">Errore.</p> : (
          <>
            <p className="sub">Arrivi: {r.totaleArrivi} · Partenze: {r.totalePartenze} · {r.righe.length} righe</p>
            {r.avvisi.map((a, i) => <p key={i} className="err">⚠️ {a}</p>)}
            <pre style={{ background: 'var(--bg)', padding: 10, borderRadius: 8, fontSize: 12, overflowX: 'auto', maxHeight: 200 }}>{r.contenuto || '(nessun movimento nel mese)'}</pre>
            <div className="modalactions">
              <a className="add" href={`/api/nuovo/sinfonia?immobile=${immobileId}&anno=${anno}&mese=${mese}&scarica=1`} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>⬇️ Scarica .txt</a>
            </div>
            <p className="empty" style={{ marginTop: 8 }}>Bozza: la provenienza degli ospiti è stimata dove manca la schedina. Da confrontare col portale Sinfonia reale prima dell&apos;invio.</p>
          </>
        )}
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
.topright{display:flex;flex-direction:column;align-items:flex-end;gap:6px;}
.sync{font-size:12px;font-weight:700;padding:6px 12px;border-radius:100px;border:1px solid var(--coral);background:var(--coral-soft);color:var(--coral);}
.sync:disabled{opacity:.6;}
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
.rendctl{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}
.rendctl select{padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font-size:13px;font-family:inherit;}
.rendtot{display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:14px 16px;background:var(--coral-soft);border-radius:12px;}
.rendtot span{font-weight:700;}
.rendtot b{font-size:22px;color:var(--coral);}
.tree{font-size:13px;line-height:1.5;}
.tn{position:relative;}
.tn span{color:var(--ink-muted);font-weight:400;}
.tn1,.tn2,.tn3,.tn4{margin-left:16px;padding-left:14px;border-left:2px solid var(--line);margin-top:8px;}
.tn0{margin-top:4px;}
.tn4{margin-top:5px;font-size:12.5px;}
.guidalist{margin:0;padding-left:18px;font-size:13px;line-height:1.7;}
.guidalist li{margin-bottom:4px;}
.linklike{border:none;background:none;color:var(--coral);font-weight:600;cursor:pointer;padding:0;font-size:inherit;}
.cardhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;}
.cardhead h2{margin:0;}
.add{background:var(--coral);color:#fff;border:none;border-radius:100px;padding:8px 14px;font-size:13px;font-weight:700;}
.danger{background:none;border:1px solid #E5484D;color:#E5484D;border-radius:100px;padding:8px 12px;font-size:12px;font-weight:700;}
.form{display:flex;flex-direction:column;gap:10px;margin:12px 0;}
.form label{display:flex;flex-direction:column;font-size:12px;font-weight:600;color:var(--ink-muted);gap:4px;}
.form input,.form select{padding:9px 11px;font-size:16px;border:1.5px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font-family:inherit;}
.modalactions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}
.modalactions button{padding:9px 16px;border-radius:100px;font-size:13px;font-weight:700;border:1px solid var(--line);background:var(--surface);color:var(--ink);}
.modal{max-height:90vh;overflow-y:auto;}
`;
