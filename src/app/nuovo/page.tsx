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
  utile: number; nettoProprietario: number; stato: string; numeroOspiti: number; origine: string; penaleImporto: number | null; note: string;
  checkinConfermatoIl: string | null; waCheckinNumero: string | null; waCheckinMessaggio: string | null;
  pagamenti: { id: string; tipo: string; importo: number; data: string; metodo: string | null }[];
};
type Pulizia = {
  id: string; data: string; alloggioId: string; alloggio: string; confermataIl: string | null; note: string | null;
  origine: string; addettoNome: string | null; prenotazioneId: string | null; pagata: boolean; importo: string | null;
};
type Operatore = { id: string; nome: string };
type DocumentoCaricato = { id: string; tipo: string; nome: string; ospiteId: string | null; prenotazioneId: string | null; driveUrl: string | null; caricatoIl: string };
type UtenteAdmin = { id: string; nome: string; ruolo: string; username: string | null; codiceInvito: string | null; attivo: boolean; proprietarioId: string | null };
type Permesso = { utente_id: string; immobile_id: string; puo_vedere: boolean; puo_modificare: boolean; puo_vedere_finanziario: boolean };
type Alloggio = {
  id: string; nome: string; attivo: boolean; regimeFiscale: string; costoPulizia: string;
  emoji: string | null; wifiSsid: string | null; immobile: string; indirizzo: string;
  trasmetteAlloggiati: boolean; impostaSoggiornoComune: string | null;
};
type Ospite = { id: string; nome: string; cognome: string; telefono: string | null; email: string | null; codice_fiscale: string | null; valutazione: string; note: string | null };
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
type Scadenza = { id: string; titolo: string; ente: string | null; dataScadenza: string; ricorrenza: string; note: string | null; ultimoCompletamento: string | null; immobile: string | null };
type Spesa = { id: string; data: string; descrizione: string; importo: string; categoria: string; immobile: string | null; note: string | null };
type CosaManca = {
  schedineDaInviare: { id: string; cognome: string; nome: string; scadeIl: string | null; alloggio: string }[];
  scadenzeVicine: { id: string; titolo: string; dataScadenza: string; immobile: string | null }[];
  pulizieDaFare: { id: string; data: string; alloggio: string }[];
  pagamentiInSospeso: { id: string; ospite: string; checkin: string; lordo: string; alloggio: string }[];
};
type SchedinaAlloggiati = {
  id: string; cognome: string; nome: string; ospiteNomeCompleto: string;
  alloggioNome: string; prenotazioneId: string; checkin: string; checkout: string; canale: string;
};
type Preventivo = {
  id: string; codice: string; stato: 'Bozza' | 'Inviato' | 'Accettato' | 'Scaduto' | 'Rifiutato';
  checkin: string; checkout: string; numeroOspiti: number;
  prezzoNotte: string | null; totalePieno: string; sconto: string; scontoTipo: string; totale: string;
  validoOre: number; note: string | null;
  creatoIl: string; inviatoIl: string | null; accettatoIl: string | null; prenotazioneId: string | null;
  alloggioId: string; alloggio: string; immobile: string;
  ospiteId: string | null; ospiteNome: string | null; ospiteCognome: string | null; ospiteTelefono: string | null;
};
type Richiesta = {
  id: string; checkin: string; checkout: string; numeroOspiti: number; nome: string; telefono: string;
  note: string | null; creatoIl: string; alloggioId: string; alloggio: string;
};
type Dati = {
  ok: boolean; oggi: string; prenotazioni: Prenotazione[]; ospiti: Ospite[];
  anagrafica: Anagrafica; alloggi: Alloggio[]; spese: Spesa[]; scadenze: Scadenza[];
  riepilogoMese: RigaMese[]; cosaManca: CosaManca; preventivi?: Preventivo[]; pulizie?: Pulizia[];
  richieste?: Richiesta[];
  operatoriPulizie?: Operatore[]; utenti?: UtenteAdmin[]; permessi?: Permesso[]; documenti?: DocumentoCaricato[];
  schedineAlloggiati?: SchedinaAlloggiati[];
  categorieSpesa?: { id: string; nome: string }[];
  eventi?: { id: string; titolo: string; dal: string; al: string; comune: string | null; impatto: string; note: string | null }[];
  prezzi?: { id: string; dal: string; al: string; prezzoNotte: string; note: string | null; alloggioId: string | null; alloggio: string | null }[];
  blocchi?: { id: string; alloggioId: string; alloggio: string; checkin: string; checkout: string; nota: string | null }[];
};
type SintesiMese = { anno: number; mese: number; prenotazioni: number; lordo: number; nettoProprietario: number };
type Rendiconto = {
  proprietario: string; anno: number; mese: number;
  ambito: { etichetta: string; tipo: 'tutto' | 'immobile' | 'alloggio'; immobileId: string | null; alloggioId: string | null };
  righe: { id: string; checkin: string; checkout: string; alloggio: string; immobile: string; canale: string;
    ospite: string; lordo: string; commissione: string; cedolare: string; costoPulizia: string;
    feeGestione: string; utile: string; nettoProprietario: string }[];
  spese: { id: string; data: string; descrizione: string; importo: string; categoria: string; immobile: string }[];
  totali: { lordo: number; commissione: number; cedolare: number; costoPulizia: number; feeGestione: number;
    utile: number; nettoProprietario: number; totSpese: number; nettoFinale: number; impostaSoggiorno: number; numPrenotazioni: number };
  confronti: {
    meseScorso: SintesiMese; annoScorso: SintesiMese;
    previsione: { anno: number; mese: number; acquisito: Omit<SintesiMese, 'anno' | 'mese'>; annoScorso: Omit<SintesiMese, 'anno' | 'mese'> };
  };
};

const eur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const neg = (n: number) => (n > 0.005 ? '−' : '') + eur(n);
const dataIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const CANALE_COLOR: Record<string, string> = {
  'Airbnb': '#FF5A5F', 'Booking': '#1D6DF0', 'Diretto': '#1FAA6E', 'No Tax': '#8C7BD8',
};
// La scheda 'documenti' mostra soprattutto i preventivi (più le richieste dal sito e i file
// veri su Drive) — il nome in tab riflette quello che ci si trova davvero.
const TAB_LABEL: Partial<Record<string, string>> = { documenti: 'Preventivi', alloggiati: 'Alloggiati Web' };

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

// ── Tema chiaro/scuro ──────────────────────────────────────────────────────
type Tema = 'auto' | 'light' | 'dark';
function applicaTema(t: Tema) {
  const el = document.documentElement;
  if (t === 'auto') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t);
}
function TemaToggle() {
  const [t, setT] = useState<Tema>('auto');
  useEffect(() => {
    let v: Tema = 'auto';
    try { v = (localStorage.getItem('sh_tema') as Tema) || 'auto'; } catch { /* */ }
    setT(v); applicaTema(v);
  }, []);
  function scegli(v: Tema) {
    setT(v); applicaTema(v);
    try { localStorage.setItem('sh_tema', v); } catch { /* */ }
  }
  const next: Record<Tema, Tema> = { auto: 'light', light: 'dark', dark: 'auto' };
  const icona: Record<Tema, string> = { auto: '🌗', light: '☀️', dark: '🌙' };
  const label: Record<Tema, string> = { auto: 'automatico', light: 'chiaro', dark: 'scuro' };
  return (
    <button className="tematoggle" onClick={() => scegli(next[t])} title={`Tema: ${label[t]} — tocca per cambiare`}>
      {icona[t]} <span>{label[t]}</span>
    </button>
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
  const [primoAccesso, setPrimoAccesso] = useState(false);
  const [pa, setPa] = useState({ codice: '', username: '', password: '' });
  const [paOk, setPaOk] = useState(false);
  const [dati, setDati] = useState<Dati | null>(null);
  const [errore, setErrore] = useState('');
  const [tab, setTab] = useState<'dashboard' | 'calendario' | 'prenotazioni' | 'ospiti' | 'documenti' | 'immobili' | 'spese' | 'scadenze' | 'pulizie' | 'alloggiati' | 'rendiconti' | 'guida'>('dashboard');
  const [prenSel, setPrenSel] = useState<Prenotazione | null>(null);
  const [prenSelAzione, setPrenSelAzione] = useState<'pagamento' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [nuovaPren, setNuovaPren] = useState(false);
  const [preventivo, setPreventivo] = useState(false);
  const [sinfoniaImm, setSinfoniaImm] = useState<string | null>(null);
  const [calAlloggio, setCalAlloggio] = useState<{ id: string; nome: string } | null>(null);
  const [modale, setModale] = useState<null | { titolo: string; campi: Campo[]; azione: string; id?: string; iniziali?: Record<string, unknown> }>(null);
  const [qOspiti, setQOspiti] = useState('');
  const [fPren, setFPren] = useState({ q: '', stato: '', alloggio: '', canale: '', periodo: 'futuro' });

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

  async function inviaPrimoAccesso(e: React.FormEvent) {
    e.preventDefault(); setErrore('');
    const r = await fetch('/api/nuovo/primo-accesso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codiceInvito: pa.codice, username: pa.username, password: pa.password }) });
    const d = await r.json();
    if (d.ok) { setPaOk(true); setPa({ codice: '', username: '', password: '' }); } else setErrore(d.error || 'Errore');
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
          <div className="gatetema"><TemaToggle /></div>
          <div className="gatemark">S</div>
          <span className="eyebrow">Salzillo Hospitality</span>
          <h1>Nuovo sistema</h1>
          {!primoAccesso ? (
            <>
              <form onSubmit={login}>
                <div className="field"><span className="fic">👤</span><input value={u} onChange={(e) => setU(e.target.value)} placeholder="utente" autoFocus autoComplete="username" /></div>
                <div className="field"><span className="fic">🔒</span><input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="password" autoComplete="current-password" /></div>
                <button type="submit">Entra →</button>
              </form>
              <p className="sub" style={{ textAlign: 'center', marginTop: 10 }}>
                Hai un codice invito? <button type="button" className="linklike" onClick={() => { setPrimoAccesso(true); setErrore(''); setPaOk(false); }}>Primo accesso</button>
              </p>
            </>
          ) : paOk ? (
            <>
              <p className="empty" style={{ textAlign: 'center' }}>Account creato — ora puoi entrare con lo username e la password che hai scelto.</p>
              <button className="add" onClick={() => { setPrimoAccesso(false); setPaOk(false); }}>Torna al login</button>
            </>
          ) : (
            <>
              <p className="sub">Inserisci il codice invito che ti ha dato Raffaele, poi scegli tu username e password — nessun altro li conoscerà.</p>
              <form onSubmit={inviaPrimoAccesso}>
                <div className="field"><span className="fic">🎟️</span><input value={pa.codice} onChange={(e) => setPa({ ...pa, codice: e.target.value.toUpperCase() })} placeholder="codice invito" autoFocus /></div>
                <div className="field"><span className="fic">👤</span><input value={pa.username} onChange={(e) => setPa({ ...pa, username: e.target.value })} placeholder="scegli uno username" autoComplete="username" /></div>
                <div className="field"><span className="fic">🔒</span><input type="password" value={pa.password} onChange={(e) => setPa({ ...pa, password: e.target.value })} placeholder="scegli una password (min. 8 caratteri)" autoComplete="new-password" /></div>
                <button type="submit">Crea il mio accesso</button>
              </form>
              <p className="sub" style={{ textAlign: 'center', marginTop: 10 }}>
                <button type="button" className="linklike" onClick={() => { setPrimoAccesso(false); setErrore(''); }}>Torna al login</button>
              </p>
            </>
          )}
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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <TemaToggle />
            {sess.ruolo === 'Titolare' && <button className="sync" onClick={aggiorna} disabled={syncing}>{syncing ? 'aggiorno…' : '↻ aggiorna dal foglio'}</button>}
          </div>
        </div>
      </header>

      <nav className="tabs">
        {(['dashboard', 'calendario', 'prenotazioni', 'ospiti', 'documenti', 'immobili', 'spese', 'scadenze', 'pulizie', 'alloggiati', 'rendiconti', 'guida'] as const)
          .filter((t) => t !== 'alloggiati' || sess.ruolo === 'Titolare')
          .map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {TAB_LABEL[t] ?? t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
      </nav>

      {tab === 'dashboard' && (
        <>
        {sess.puoModificare && (
          <div className="azionirapide">
            <button className="add" onClick={() => setNuovaPren(true)}>＋ Nuova prenotazione</button>
            <button className="add" onClick={() => setPreventivo(true)}>📄 Nuovo preventivo</button>
            <button className="add" onClick={() => setTab('calendario')}>📅 Calendario</button>
            <button className="add" onClick={() => setTab('documenti')}>📁 Preventivi</button>
          </div>
        )}
        <div className="grid">
          <div className="card">
            <h2><i className="ic ic-arrivi">🛬</i>Arrivi <small>prossimi 7 giorni</small></h2>
            {arrivi.length === 0 ? <p className="empty">Nessun arrivo.</p> : arrivi.map((p) => (
              <div key={p.id} className="row" onClick={() => setPrenSel(p)}>
                {p.checkin === oggi
                  ? <span className="chip-oggi">OGGI</span>
                  : <b>{dataIt(p.checkin)}</b>}
                <span>{p.ospite}</span>
                <span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.alloggio}</span>
                {sess.puoModificare && (
                  <span style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    {p.waCheckinNumero && p.waCheckinMessaggio && (
                      <a className="mini" title="Invia le info di check-in su WhatsApp"
                        href={`https://wa.me/${p.waCheckinNumero}?text=${encodeURIComponent(p.waCheckinMessaggio)}`}
                        target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>💬</a>
                    )}
                    <button className="mini" title={p.checkinConfermatoIl ? `Arrivato — clicca per annullare` : 'Segna come arrivato'}
                      style={p.checkinConfermatoIl ? { background: '#1FAA6E22', color: '#1FAA6E', borderColor: '#1FAA6E55' } : undefined}
                      onClick={async (e) => { e.stopPropagation(); await api('conferma-checkin-prenotazione', { id: p.id }); await carica(); }}>
                      {p.checkinConfermatoIl ? '✓ arrivato' : '○ arrivato?'}
                    </button>
                    {p.origine !== 'Foglio' && (
                      <button className="mini" title="Registra il pagamento" onClick={(e) => { e.stopPropagation(); setPrenSel(p); setPrenSelAzione('pagamento'); }}>💰</button>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="card">
            <h2><i className="ic ic-partenze">🛫</i>Partenze <small>prossimi 7 giorni</small></h2>
            {partenze.length === 0 ? <p className="empty">Nessuna partenza.</p> : partenze.map((p) => (
              <div key={p.id} className="row" onClick={() => setPrenSel(p)}>
                {p.checkout === oggi
                  ? <span className="chip-oggi">OGGI</span>
                  : <b>{dataIt(p.checkout)}</b>}
                <span>{p.ospite}</span>
                <span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.alloggio}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h2><i className="ic ic-mese">📊</i><span style={{ textTransform: 'capitalize' }}>{meseNome}</span></h2>
            <div className="tablescroll">
              <table className="tbl">
                <tbody>
                  {dati.riepilogoMese.map((r) => (
                    <tr key={r.immobile}><td>{r.immobile}<small> · {r.proprietario}</small></td><td className="num">{r.prenotazioni}</td><td className="num">{eur(r.lordo)}</td><td className="num strong">{eur(r.utile)}</td></tr>
                  ))}
                  <tr className="tot"><td>Totale</td><td className="num">{totMese.n}</td><td className="num">{eur(totMese.lordo)}</td><td className="num strong">{eur(totMese.utile)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <h2><i className="ic ic-occ">🏠</i>Occupazione <small>adesso</small></h2>
            <p className="big">{occupatiOggi.length} / {dati.alloggi.filter((a) => a.attivo).length} <small>alloggi occupati</small></p>
            {occupatiOggi.map((p) => (
              <div key={p.id} className="row" onClick={() => setPrenSel(p)}>
                <span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.alloggio}</span>
                <span>{p.ospite}</span> <small>fino al {dataIt(p.checkout)}</small>
              </div>
            ))}
          </div>
          <div className="card">
            <h2><i className="ic ic-manca">📋</i>Cosa manca</h2>
            {(() => {
              const cm = dati.cosaManca;
              const vuoto = cm.schedineDaInviare.length + cm.scadenzeVicine.length + cm.pulizieDaFare.length + cm.pagamentiInSospeso.length === 0;
              if (vuoto) return <p className="empty">Tutto in ordine — niente in sospeso.</p>;
              return <>
                {cm.schedineDaInviare.map((s) => <div key={s.id} className="row"><span className="chip" style={{ background: '#E5484D22', color: '#E5484D' }}>schedina</span> {s.cognome} {s.nome} <small>{s.alloggio}{s.scadeIl ? ` · entro ${new Date(s.scadeIl).toLocaleString('it-IT')}` : ''}</small></div>)}
                {cm.pulizieDaFare.map((p) => <div key={p.id} className="row"><span className="chip" style={{ background: '#FFB23822', color: '#C97A16' }}>pulizia</span> {p.alloggio} <small>{dataIt(p.data)}</small>
                  {sess.puoModificare && <button className="mini" style={{ marginLeft: 'auto' }} onClick={async () => { if (confirm(`Pulizia ${p.alloggio} del ${dataIt(p.data)}: segnare come fatta?`)) { await api('conferma-pulizia', { id: p.id }); await carica(); } }}>✓ fatto</button>}
                </div>)}
                {cm.scadenzeVicine.map((s) => <div key={s.id} className="row"><span className="chip" style={{ background: '#8C7BD822', color: '#8C7BD8' }}>scadenza</span> {s.titolo} <small>{dataIt(s.dataScadenza)}{s.immobile ? ` · ${s.immobile}` : ''}</small></div>)}
                {cm.pagamentiInSospeso.map((p) => <div key={p.id} className="row"><span className="chip" style={{ background: '#1D6DF022', color: '#1D6DF0' }}>pagamento</span> {p.ospite} <small>{p.alloggio} · {dataIt(p.checkin)} · {eur(Number(p.lordo))}</small></div>)}
              </>;
            })()}
          </div>
        </div>
        </>
      )}

      {tab === 'rendiconti' && <Rendiconti anagrafica={dati.anagrafica} oggi={oggi} />}

      {tab === 'documenti' && <Documenti preventivi={dati.preventivi ?? []} documenti={dati.documenti ?? []} richieste={dati.richieste ?? []} ospiti={dati.ospiti} oggi={oggi} puoModificare={sess.puoModificare} ruoloTitolare={sess.ruolo === 'Titolare'} onCambiato={carica} onNuovoPreventivo={() => setPreventivo(true)} />}

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
              <li><b>Dashboard</b> — il riepilogo del giorno: chi arriva/parte, soldi del mese, cosa manca, occupazione. In alto le scorciatoie rapide</li>
              <li><b>Calendario</b> — vista stile Airbnb: righe = alloggi, barre colorate = prenotazioni. Sotto-schede <b>Prezzi</b> (prezzo/notte consigliato per periodo) ed <b>Eventi</b> (sagre, fiere, ponti — i giorni con eventi si evidenziano)</li>
              <li><b>Prenotazioni</b> — l&apos;elenco completo con ricerca e filtri. Da qui crei una prenotazione o un preventivo. Click su una riga → dettagli, modifica, registra pagamento</li>
              <li><b>Ospiti</b> — l&apos;anagrafica. Cerca e clicca per modificare</li>
              <li><b>Documenti</b> — i preventivi salvati, una cartella per ospite. Stato Bozza → Inviato → Accettato; &quot;segna accettato&quot; crea la prenotazione</li>
              <li><b>Immobili</b> — proprietari, immobili, alloggi. Da qui si aggiungono e si modificano</li>
              <li><b>Spese</b> — i costi. <b>Scadenze</b> — raggruppate per ente/regione, col pulsante &quot;Scadenze tipiche&quot;</li>
              <li><b>Pulizie</b> — quelle di check-out si aggiungono da sole; &quot;Pulizia extra&quot; per richieste in più durante il soggiorno. Da qui il Titolare gestisce anche &quot;Chi ha accesso al sistema&quot; (inviti e permessi)</li>
              <li><b>Alloggiati Web</b> (solo Titolare) — invio vero e diretto alla Polizia di Stato, un click alla volta. Compaiono solo le schedine Il Tulipano con canale Airbnb/Booking/Diretto; il sistema rivalida i dati (Test) prima di ogni invio reale (Send)</li>
              <li><b>Rendiconti</b> — quanto spetta a ogni proprietario, con confronto e previsione, PDF pronto da mandare</li>
            </ul>
            <p className="empty" style={{ marginTop: 8 }}>In alto a destra: interruttore <b>tema</b> (automatico / chiaro / scuro).</p>
          </div>
          <div className="card">
            <h2>Dove sono i file</h2>
            <p className="sub">Su Google Drive, cartella <b>&quot;Archivio — Salzillo Hospitality&quot;</b>:</p>
            <div className="tree">
              <div className="tn tn0">📁 Archivio — Salzillo Hospitality
                <div className="tn tn1">📊 SH · Prenotazioni &amp; Ospiti</div>
                <div className="tn tn1">📊 SH · Struttura &amp; Spese</div>
                <div className="tn tn1">📊 SH · Sistema</div>
                <div className="tn tn1">📁 Documenti Salzillo Hospitality <span>— una cartella per ospite, coi PDF</span></div>
              </div>
            </div>
            <p className="empty" style={{ marginTop: 12 }}>
              Dall&apos;11/09/2026 questo sito (il &quot;nuovo sistema&quot;) è la fonte di verità: ogni prenotazione, spesa, scadenza, ospite, pulizia, preventivo, evento locale, contratto di gestione o prezzo per periodo che crei o modifichi qui si scrive automaticamente anche sui 3 fogli sopra. Il foglio resta quindi sempre una riserva completa e aggiornata — utile se questo sito fosse mai irraggiungibile — ma non va più modificato a mano: qualsiasi modifica fatta lì non torna indietro nel nuovo sistema.
            </p>
            <p className="empty" style={{ marginTop: 8 }}>
              Esiste anche un link di sola visualizzazione, senza login, da condividere con chi deve solo vedere il calendario (es. la famiglia): mostra chi arriva/parte e i dettagli di ogni prenotazione, senza poter modificare nulla. Chiedi a Raffaele il link se ti serve.
            </p>
          </div>
        </div>
      )}

      {tab === 'calendario' && <SezioneCalendario dati={dati} attive={attive} oggi={oggi} onSel={setPrenSel} puoModificare={sess.puoModificare} onCambiato={carica} />}

      {tab === 'prenotazioni' && (() => {
        const q = fPren.q.trim().toLowerCase();
        const lista = dati.prenotazioni.filter((p) => {
          if (q && !`${p.ospite} ${p.alloggio} ${p.canale} ${p.note ?? ''}`.toLowerCase().includes(q)) return false;
          if (fPren.stato && p.stato !== fPren.stato) return false;
          if (fPren.alloggio && p.alloggio !== fPren.alloggio) return false;
          if (fPren.canale && p.canale !== fPren.canale) return false;
          if (fPren.periodo === 'futuro' && p.checkout < oggi) return false;
          if (fPren.periodo === 'passato' && p.checkout >= oggi) return false;
          return true;
        }).sort((a, b) => fPren.periodo === 'passato' ? b.checkin.localeCompare(a.checkin) : a.checkin.localeCompare(b.checkin));
        const somma = lista.reduce((s, p) => ({ lordo: s.lordo + p.lordo, utile: s.utile + p.utile }), { lordo: 0, utile: 0 });
        const nomiAlloggi = [...new Set(dati.prenotazioni.map((p) => p.alloggio))].sort();
        return (
          <div className="card">
            <div className="cardhead">
              <h2>Prenotazioni <small>({lista.length}{lista.length !== dati.prenotazioni.length ? ` di ${dati.prenotazioni.length}` : ''})</small></h2>
              {sess.puoModificare && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="add" onClick={() => setPreventivo(true)}>📄 Nuovo preventivo</button>
                <button className="add" onClick={() => setNuovaPren(true)}>＋ Nuova prenotazione</button>
              </div>}
            </div>
            <div className="filtri">
              <input className="cerca" placeholder="Cerca ospite, alloggio, note…" value={fPren.q} onChange={(e) => setFPren({ ...fPren, q: e.target.value })} />
              <select value={fPren.periodo} onChange={(e) => setFPren({ ...fPren, periodo: e.target.value })}>
                <option value="futuro">In corso e future</option>
                <option value="passato">Passate</option>
                <option value="">Tutte</option>
              </select>
              <select value={fPren.stato} onChange={(e) => setFPren({ ...fPren, stato: e.target.value })}>
                <option value="">Ogni stato</option>
                {['Attiva', 'In attesa di conferma', 'Cancellata', 'Cancellata con penale', 'No-show'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={fPren.alloggio} onChange={(e) => setFPren({ ...fPren, alloggio: e.target.value })}>
                <option value="">Ogni alloggio</option>
                {nomiAlloggi.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={fPren.canale} onChange={(e) => setFPren({ ...fPren, canale: e.target.value })}>
                <option value="">Ogni canale</option>
                {['Airbnb', 'Booking', 'Diretto', 'No Tax'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="tablescroll">
              <table className="tbl full">
                <thead><tr><th>Check-in</th><th>Check-out</th><th>Ospite</th><th>Alloggio</th><th>Canale</th><th className="num">Lordo</th><th className="num">Utile</th><th>Stato</th></tr></thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.id} onClick={() => setPrenSel(p)}>
                      <td>{dataIt(p.checkin)}</td><td>{dataIt(p.checkout)}</td><td>{p.ospite}</td><td>{p.alloggio}</td>
                      <td><span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.canale}</span></td>
                      <td className="num">{eur(p.lordo)}</td><td className="num strong">{eur(p.utile)}</td>
                      <td>{p.stato === 'Attiva' ? '✅' : p.stato === 'In attesa di conferma' ? '⏳' : '❌'} <small>{p.stato}</small></td>
                    </tr>
                  ))}
                  {lista.length === 0 && <tr><td colSpan={8} className="empty">Nessuna prenotazione con questi filtri.</td></tr>}
                  {lista.length > 0 && (
                    <tr className="tot"><td colSpan={5}>Totale ({lista.length})</td>
                      <td className="num">{eur(somma.lordo)}</td><td className="num strong">{eur(somma.utile)}</td><td></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {tab === 'ospiti' && (() => {
        const campiOspite: Campo[] = [
          { k: 'cognome', label: 'Cognome', req: true }, { k: 'nome', label: 'Nome', req: true },
          { k: 'telefono', label: 'Telefono' }, { k: 'email', label: 'Email' },
          { k: 'codiceFiscale', label: 'Codice fiscale' },
          { k: 'valutazione', label: 'Valutazione', tipo: 'select', opzioni: [{ v: 'Neutro', t: 'Neutro' }, { v: 'Buono', t: 'Buono' }, { v: 'Problematico', t: 'Problematico' }] },
          { k: 'note', label: 'Note' },
        ];
        const q = qOspiti.trim().toLowerCase();
        const lista = q
          ? dati.ospiti.filter((o) => `${o.cognome} ${o.nome} ${o.telefono ?? ''} ${o.email ?? ''}`.toLowerCase().includes(q))
          : dati.ospiti;
        return (
          <div className="card">
            <div className="cardhead">
              <h2>Ospiti <small>({lista.length}{q ? ` di ${dati.ospiti.length}` : ''})</small></h2>
              {sess.puoModificare && <button className="add" onClick={() => setModale({ titolo: 'Nuovo ospite', azione: 'crea-ospite', campi: campiOspite, iniziali: { valutazione: 'Neutro' } })}>＋ Ospite</button>}
            </div>
            <input className="cerca" placeholder="Cerca per nome, cognome, telefono, email…" value={qOspiti} onChange={(e) => setQOspiti(e.target.value)} />
            <div className="tablescroll">
              <table className="tbl full">
                <thead><tr><th>Cognome</th><th>Nome</th><th>Telefono</th><th>Email</th><th>Valutazione</th>{sess.ruolo === 'Titolare' && <th></th>}</tr></thead>
                <tbody>
                  {lista.map((o) => (
                    <tr key={o.id} className={sess.puoModificare ? 'clic' : undefined}
                      onClick={() => sess.puoModificare && setModale({
                        titolo: `${o.cognome} ${o.nome}`.trim(), azione: 'aggiorna-ospite', id: o.id, campi: campiOspite,
                        iniziali: { cognome: o.cognome, nome: o.nome, telefono: o.telefono ?? '', email: o.email ?? '', codiceFiscale: o.codice_fiscale ?? '', valutazione: o.valutazione, note: o.note ?? '' },
                      })}>
                      <td>{o.cognome}</td><td>{o.nome}</td><td>{o.telefono || '—'}</td><td>{o.email || '—'}</td>
                      <td><span className={`vchip v-${o.valutazione}`}>{o.valutazione}</span></td>
                      {sess.ruolo === 'Titolare' && <td>
                        <button className="mini" onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Eliminare ${o.cognome} ${o.nome}? Funziona solo se non ha prenotazioni/preventivi/documenti agganciati.`)) return;
                          try { await api('elimina-ospite', { id: o.id }); await carica(); }
                          catch (err) { alert(err instanceof Error ? err.message : String(err)); }
                        }}>🗑</button>
                      </td>}
                    </tr>
                  ))}
                  {lista.length === 0 && <tr><td colSpan={sess.ruolo === 'Titolare' ? 6 : 5} className="empty">Nessun ospite trovato.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

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
                      {sess.ruolo === 'Titolare' && <button className="linklike" style={{ marginLeft: 'auto' }} onClick={(e) => { e.stopPropagation(); setCalAlloggio({ id: a.id, nome: a.nome }); }}>📅 calendari</button>}
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

      {tab === 'scadenze' && (() => {
        const oggiD = oggi;
        const fra30 = new Date(Date.parse(oggi) + 30 * 864e5).toISOString().slice(0, 10);
        const gruppi = new Map<string, Scadenza[]>();
        for (const s of [...dati.scadenze].sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza))) {
          const k = s.ente || (s.immobile ? s.immobile : 'Generali');
          if (!gruppi.has(k)) gruppi.set(k, []);
          gruppi.get(k)!.push(s);
        }
        const ordine = [...gruppi.keys()].sort();
        return (
          <div className="card">
            <div className="cardhead">
              <h2>Scadenze <small>({dati.scadenze.length})</small></h2>
              {sess.puoModificare && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {dati.scadenze.length === 0 && <button className="add" onClick={async () => { if (confirm('Aggiungo le scadenze fiscali/amministrative tipiche di un B&B in Campania?')) { await api('seed-scadenze'); await carica(); } }}>✨ Scadenze tipiche</button>}
                <button className="add" onClick={() => setModale({ titolo: 'Nuova scadenza', azione: 'crea-scadenza', campi: [
                  { k: 'titolo', label: 'Titolo', req: true },
                  { k: 'ente', label: 'Ente / regione', tipo: 'select', opzioni: ['', 'Questura (Alloggiati Web)', 'Regione Campania', 'Comune', 'Agenzia delle Entrate', 'Ministero del Turismo', 'SIAE', 'Altro'].map((v) => ({ v, t: v || '— nessuno —' })) },
                  { k: 'dataScadenza', label: 'Data', tipo: 'date', req: true },
                  { k: 'ricorrenza', label: 'Ricorrenza', tipo: 'select', opzioni: ['Una tantum', 'Mensile', 'Semestrale', 'Annuale'].map((r) => ({ v: r, t: r })) },
                  { k: 'immobileId', label: 'Immobile (vuoto = generale)', tipo: 'select', opzioni: [{ v: '', t: '— generale —' }, ...dati.anagrafica.flatMap((p) => p.immobili.map((i) => ({ v: i.id, t: i.nome })))] },
                  { k: 'note', label: 'Note' },
                ] })}>＋ Scadenza</button>
              </div>}
            </div>
            {dati.scadenze.length === 0 && <p className="empty">Nessuna scadenza. Usa &quot;Scadenze tipiche&quot; per partire.</p>}
            {ordine.map((k) => (
              <div key={k} className="docgroup">
                <h3><span>🏛️ {k}</span><span className="empty">{gruppi.get(k)!.length}</span></h3>
                {gruppi.get(k)!.map((s) => {
                  const urg = s.dataScadenza <= oggiD ? 'scaduta' : s.dataScadenza <= fra30 ? 'vicina' : '';
                  return (
                    <div key={s.id} className="docrow">
                      <span className={`pill ${urg === 'scaduta' ? 'pill-Scaduto' : urg === 'vicina' ? 'pill-Inviato' : 'pill-Bozza'}`}>{dataIt(s.dataScadenza)}</span>
                      <b>{s.titolo}</b>
                      <span className="empty">{s.ricorrenza !== 'Una tantum' ? s.ricorrenza.toLowerCase() : ''} {s.immobile ? `· ${s.immobile}` : ''}</span>
                      {s.note && <span className="empty" style={{ flexBasis: '100%' }}>{s.note}</span>}
                      {sess.puoModificare && <span className="azioni"><button className="mini" onClick={async () => { if (confirm('Segnare come fatta?')) { await api('completa-scadenza', { id: s.id }); await carica(); } }}>✓ fatto</button></span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })()}

      {tab === 'pulizie' && (() => {
        const tutte = dati.pulizie ?? [];
        const operatori = dati.operatoriPulizie ?? [];
        const puoGestire = sess.ruolo !== 'Proprietario';
        const daFare = tutte.filter((pu) => !pu.confermataIl).sort((a, b) => a.data.localeCompare(b.data));
        const fatte = tutte.filter((pu) => pu.confermataIl).slice(0, 20);
        return (
          <>
          <div className="card">
            <div className="cardhead">
              <h2>Pulizie <small>({daFare.length} da fare)</small></h2>
              {puoGestire && <button className="add" onClick={() => setModale({
                titolo: 'Pulizia extra', azione: 'crea-pulizia',
                iniziali: { alloggioId: dati.alloggi.find((a) => a.attivo)?.id },
                campi: [
                  { k: 'alloggioId', label: 'Alloggio', tipo: 'select', req: true, opzioni: dati.alloggi.filter((a) => a.attivo).map((a) => ({ v: a.id, t: a.nome })) },
                  { k: 'data', label: 'Data', tipo: 'date', req: true },
                  { k: 'note', label: 'Note (facoltativa)' },
                  { k: 'pagata', label: 'Richiesta a pagamento dall’ospite', tipo: 'checkbox' },
                  { k: 'importo', label: 'Importo € (se a pagamento)', tipo: 'number' },
                ],
              })}>＋ Pulizia extra</button>}
            </div>
            <p className="sub">Quelle di check-out si aggiungono da sole quando registri una prenotazione. Usa &quot;Pulizia extra&quot; solo per richieste in più durante il soggiorno (a pagamento) o pulizie fuori da un soggiorno.</p>
            {daFare.length === 0 ? <p className="empty">Nessuna pulizia da fare.</p> : daFare.map((pu) => (
              <RigaPulizia key={pu.id} pu={pu} operatori={operatori} oggi={oggi} puoGestire={puoGestire} onCambiato={carica} />
            ))}
            <h3 style={{ marginTop: 16 }}><span>Fatte di recente</span></h3>
            {fatte.length === 0 ? <p className="empty">Nessuna pulizia ancora confermata.</p> : fatte.map((pu) => (
              <div key={pu.id} className="docrow">
                <span className="pill pill-Accettato">{dataIt(pu.data)}</span>
                <b>{pu.alloggio}</b>
                <span className="empty">{pu.addettoNome ? `fatta da ${pu.addettoNome}` : 'fatta'} il {new Date(pu.confermataIl!).toLocaleDateString('it-IT')}</span>
                {pu.pagata && <span className="chip" style={{ background: '#1FAA6E22', color: '#1FAA6E' }}>pagata{pu.importo ? ` · ${eur(Number(pu.importo))}` : ''}</span>}
                {pu.note && <span className="empty" style={{ flexBasis: '100%' }}>{pu.note}</span>}
              </div>
            ))}
          </div>
          {sess.ruolo === 'Titolare' && <CollaboratoriBox utenti={dati.utenti ?? []} anagrafica={dati.anagrafica} permessi={dati.permessi ?? []} onCambiato={carica} />}
          </>
        );
      })()}

      {tab === 'alloggiati' && sess.ruolo === 'Titolare' && (
        <AlloggiatiWebBox schedine={dati.schedineAlloggiati ?? []} onCambiato={carica} />
      )}

      {prenSel && <DettaglioPrenotazione p={prenSel} alloggi={dati.alloggi} puoModificare={sess.puoModificare}
        apriPagamentoSubito={prenSelAzione === 'pagamento'}
        onClose={() => { setPrenSel(null); setPrenSelAzione(null); }}
        onSalvato={async () => { setPrenSel(null); setPrenSelAzione(null); await carica(); }} />}
      {nuovaPren && <FormPrenotazione alloggi={dati.alloggi} ospiti={dati.ospiti}
        onClose={() => setNuovaPren(false)} onSalvato={async () => { setNuovaPren(false); await carica(); }} />}
      {modale && <FormModale titolo={modale.titolo} campi={modale.campi} iniziali={modale.iniziali}
        onInvia={inviaModale} onClose={() => setModale(null)} />}
      {preventivo && <Preventivo alloggi={dati.alloggi} ospiti={dati.ospiti} onClose={() => setPreventivo(false)} onSalvato={async () => { setPreventivo(false); await carica(); setTab('documenti'); }} />}
      {sinfoniaImm && <SinfoniaBox immobileId={sinfoniaImm} oggi={oggi} onClose={() => setSinfoniaImm(null)} />}
      {calAlloggio && <CalendariBox alloggio={calAlloggio} onClose={() => setCalAlloggio(null)} />}
    </div>
  );
}

// ── Pulizie ──────────────────────────────────────────────────────────────────
function RigaPulizia({ pu, operatori, oggi, puoGestire, onCambiato }: {
  pu: Pulizia; operatori: Operatore[]; oggi: string; puoGestire: boolean; onCambiato: () => Promise<void>;
}) {
  const [addettoId, setAddettoId] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="docrow">
      <span className={`pill ${pu.data < oggi ? 'pill-Scaduto' : 'pill-Bozza'}`}>{dataIt(pu.data)}</span>
      <b>{pu.alloggio}</b>
      {pu.pagata && <span className="chip" style={{ background: '#1FAA6E22', color: '#1FAA6E' }}>pagata{pu.importo ? ` · ${eur(Number(pu.importo))}` : ''}</span>}
      {pu.note && <span className="empty" style={{ flexBasis: '100%' }}>{pu.note}</span>}
      {puoGestire && <span className="azioni">
        {operatori.length > 0 && (
          <select value={addettoId} onChange={(e) => setAddettoId(e.target.value)} style={{ maxWidth: 140 }}>
            <option value="">chi ha pulito?</option>
            {operatori.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        )}
        <button className="mini" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await api('conferma-pulizia', { id: pu.id, dati: { addettoId: addettoId || undefined } }); await onCambiato(); }
          finally { setBusy(false); }
        }}>{busy ? '…' : '✓ fatto'}</button>
        {pu.origine !== 'Foglio' && <button className="danger" onClick={async () => { if (confirm('Eliminare questa pulizia?')) { await api('elimina-pulizia', { id: pu.id }); await onCambiato(); } }}>elimina</button>}
      </span>}
    </div>
  );
}

// ── Collaboratori (accessi al sistema) ────────────────────────────────────────
function CollaboratoriBox({ utenti, anagrafica, permessi, onCambiato }: {
  utenti: UtenteAdmin[]; anagrafica: Anagrafica; permessi: Permesso[]; onCambiato: () => Promise<void>;
}) {
  const [nuovo, setNuovo] = useState<{ nome: string; ruolo: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [invito, setInvito] = useState<{ nome: string; codice: string } | null>(null);
  const [espanso, setEspanso] = useState<string | null>(null);
  const tuttiImmobili = anagrafica.flatMap((p) => p.immobili.map((im) => ({ ...im, proprietario: p.nome })));

  async function crea() {
    if (!nuovo?.nome.trim()) return;
    setBusy(true);
    try {
      const r = await api('invita-collaboratore', { dati: { nome: nuovo.nome.trim(), ruolo: nuovo.ruolo } });
      setInvito({ nome: nuovo.nome.trim(), codice: (r as { codice_invito: string }).codice_invito });
      setNuovo(null); await onCambiato();
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="cardhead">
        <h2>Chi ha accesso al sistema <small>({utenti.length})</small></h2>
        <button className="add" onClick={() => setNuovo({ nome: '', ruolo: 'Collaboratore' })}>＋ Persona</button>
      </div>
      <p className="sub">Tu crei la scheda (nome e ruolo), la persona sceglie DA SÉ username e password al primo accesso, usando il codice che le dai tu.</p>
      {invito && (
        <div className="form" style={{ padding: 12, background: 'var(--coral-soft)', borderRadius: 10, marginBottom: 10 }}>
          <b>Codice invito per {invito.nome}: <span style={{ fontSize: 20, letterSpacing: 2 }}>{invito.codice}</span></b>
          <p className="sub">Daglielo di persona o a voce. La persona deve andare su <b>salzillo-hospitality.vercel.app/nuovo</b>, cliccare &quot;Primo accesso&quot; sotto al modulo di login, inserire questo codice e scegliere da sé username e password.</p>
          <button onClick={() => setInvito(null)}>Ho capito</button>
        </div>
      )}
      {nuovo && (
        <div className="form" style={{ marginBottom: 10 }}>
          <label>Nome<input value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} autoFocus /></label>
          <label>Ruolo<select value={nuovo.ruolo} onChange={(e) => setNuovo({ ...nuovo, ruolo: e.target.value })}>
            {['Collaboratore', 'Pulizie', 'Proprietario'].map((r) => <option key={r}>{r}</option>)}
          </select></label>
          <div className="modalactions">
            <button className="add" onClick={crea} disabled={busy || !nuovo.nome.trim()}>{busy ? '…' : 'Crea e genera codice'}</button>
            <button onClick={() => setNuovo(null)}>Annulla</button>
          </div>
        </div>
      )}
      {utenti.map((u) => (
        <div key={u.id} className="docrow" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill pill-Bozza">{u.ruolo}</span>
            <b>{u.nome}</b>
            {u.username ? <span className="empty">@{u.username}</span> : u.codiceInvito ? <span className="empty">invito in attesa: <b>{u.codiceInvito}</b></span> : null}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {u.ruolo !== 'Titolare' && (u.ruolo === 'Collaboratore' || u.ruolo === 'Proprietario') && (
                <button className="linklike" onClick={() => setEspanso(espanso === u.id ? null : u.id)}>permessi</button>
              )}
              {u.ruolo !== 'Titolare' && (
                <button className="mini" onClick={async () => { await api('attiva-utente', { id: u.id, dati: { attivo: !u.attivo } }); await onCambiato(); }}>{u.attivo ? 'disattiva' : 'riattiva'}</button>
              )}
            </span>
          </div>
          {espanso === u.id && (
            <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid var(--line)' }}>
              {tuttiImmobili.map((im) => {
                const perm = permessi.find((p) => p.utente_id === u.id && p.immobile_id === im.id);
                const set = async (patch: Partial<{ puoVedere: boolean; puoModificare: boolean; puoVedereFinanziario: boolean }>) => {
                  await api('imposta-permesso', { dati: {
                    utenteId: u.id, immobileId: im.id,
                    puoVedere: patch.puoVedere ?? perm?.puo_vedere ?? false,
                    puoModificare: patch.puoModificare ?? perm?.puo_modificare ?? false,
                    puoVedereFinanziario: patch.puoVedereFinanziario ?? perm?.puo_vedere_finanziario ?? false,
                  } });
                  await onCambiato();
                };
                return (
                  <label key={im.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '4px 0' }}>
                    <span style={{ minWidth: 140 }}>{im.nome}</span>
                    <span><input type="checkbox" checked={!!perm?.puo_vedere} onChange={(e) => set({ puoVedere: e.target.checked })} /> vede</span>
                    <span><input type="checkbox" checked={!!perm?.puo_modificare} onChange={(e) => set({ puoModificare: e.target.checked })} /> modifica</span>
                    <span><input type="checkbox" checked={!!perm?.puo_vedere_finanziario} onChange={(e) => set({ puoVedereFinanziario: e.target.checked })} /> vede €</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Documenti / Preventivi ─────────────────────────────────────────────────
function Documenti({ preventivi, documenti, richieste, ospiti, oggi, puoModificare, ruoloTitolare, onCambiato, onNuovoPreventivo }: {
  preventivi: Preventivo[]; documenti: DocumentoCaricato[]; richieste: Richiesta[]; ospiti: Ospite[]; oggi: string; puoModificare: boolean; ruoloTitolare: boolean; onCambiato: () => Promise<void>; onNuovoPreventivo: () => void;
}) {
  const [q, setQ] = useState('');
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [statoF, setStatoF] = useState('');
  const [apri, setApri] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [prezzoRichiesta, setPrezzoRichiesta] = useState<Record<string, string>>({});

  async function azione(id: string, a: 'stato-preventivo' | 'accetta-preventivo' | 'elimina-preventivo', stato?: string) {
    setBusy(id); setErr('');
    try { await api(a, { id, dati: stato ? { stato } : {} }); await onCambiato(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  async function creaPreventivoDaRichiesta(id: string) {
    const prezzoNotte = Number(prezzoRichiesta[id]);
    if (!prezzoNotte || prezzoNotte <= 0) { setErr('Metti un prezzo a notte prima di creare il preventivo.'); return; }
    setBusy(id); setErr('');
    try { await api('crea-preventivo-da-richiesta', { id, dati: { prezzoNotte } }); await onCambiato(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  async function ignoraRichiesta(id: string) {
    if (!confirm('Ignorare questa richiesta? Non diventerà un preventivo.')) return;
    setBusy(id); setErr('');
    try { await api('ignora-richiesta', { id }); await onCambiato(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  const ql = q.trim().toLowerCase();
  const filtr = preventivi.filter((p) => {
    const nome = `${p.ospiteCognome ?? ''} ${p.ospiteNome ?? ''}`.trim();
    if (ql && !`${nome} ${p.codice} ${p.alloggio}`.toLowerCase().includes(ql)) return false;
    if (statoF && p.stato !== statoF) return false;
    return true;
  });
  // raggruppa per ospite ("cartella") — preventivi e documenti veri (Drive) insieme
  const gruppi = new Map<string, { nome: string; tel: string | null; righe: Preventivo[]; file: DocumentoCaricato[] }>();
  for (const p of filtr) {
    const nome = `${p.ospiteCognome ?? ''} ${p.ospiteNome ?? ''}`.trim() || 'Senza nome';
    const k = (p.ospiteId ?? nome);
    if (!gruppi.has(k)) gruppi.set(k, { nome, tel: p.ospiteTelefono, righe: [], file: [] });
    gruppi.get(k)!.righe.push(p);
  }
  const dql = q.trim().toLowerCase();
  for (const d of documenti) {
    if (!d.ospiteId) continue;
    const o = ospiti.find((x) => x.id === d.ospiteId);
    const nome = o ? `${o.cognome} ${o.nome}`.trim() : 'Senza nome';
    if (dql && !`${nome} ${d.tipo} ${d.nome}`.toLowerCase().includes(dql)) continue;
    if (!gruppi.has(d.ospiteId)) gruppi.set(d.ospiteId, { nome, tel: o?.telefono ?? null, righe: [], file: [] });
    gruppi.get(d.ospiteId)!.file.push(d);
  }
  // Più recente prima — non alfabetico: quello che serve aprire per primo è l'ultima cosa
  // successa con quell'ospite (nuovo preventivo, nuovo file), non chi ha il cognome più vicino
  // alla "A". La data più recente tra i suoi preventivi e i suoi file la decide.
  const ultimaAttivita = (c: { righe: Preventivo[]; file: DocumentoCaricato[] }) =>
    Math.max(0, ...c.righe.map((p) => Date.parse(p.creatoIl)), ...c.file.map((d) => Date.parse(d.caricatoIl)));
  const cartelle = [...gruppi.values()].filter((c) => c.righe.length || c.file.length).sort((a, b) => ultimaAttivita(b) - ultimaAttivita(a));

  function msgWa(p: Preventivo) {
    const saluto = new Date().getHours() < 14 ? 'Buongiorno' : 'Buonasera';
    const primo = (p.ospiteNome ?? '').trim();
    const notti = Math.round((Date.parse(p.checkout) - Date.parse(p.checkin)) / 864e5);
    const link = `${window.location.origin}/p/${p.id}`;
    return [
      `${saluto}${primo ? ' ' + primo : ''}! 👋 Sono Raffaele di *Salzillo Hospitality*.`,
      ``,
      `Ecco il tuo preventivo per *${p.alloggio}*:`,
      `📅 ${dataIt(p.checkin)} → ${dataIt(p.checkout)} (${notti} nott${notti === 1 ? 'e' : 'i'}, ${p.numeroOspiti} ospiti)`,
      `💶 Totale: *${eur(Number(p.totale))}*${Number(p.sconto) > 0 ? ` (sconto −${eur(Number(p.sconto))})` : ''}`,
      ``,
      `Le date restano riservate per te per le prossime ${p.validoOre} ore. Cancellazione gratuita fino a 48h prima del check-in.`,
      ``,
      `📄 Tutti i dettagli qui: ${link}`,
    ].join('\n');
  }
  function waUrl(p: Preventivo) {
    const t = (p.ospiteTelefono ?? '').replace(/[^\d]/g, '');
    const num = t.length === 10 ? '39' + t : t;
    return `https://wa.me/${num}?text=${encodeURIComponent(msgWa(p))}`;
  }

  return (
    <div className="card">
      <div className="cardhead">
        <h2>Preventivi <small>· {preventivi.length} preventivi · {documenti.length} file su Drive</small></h2>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ruoloTitolare && <button className="mini" disabled={backfillBusy} onClick={async () => {
            setBackfillBusy(true);
            try {
              const r = await api('backfill-preventivi-drive') as { salvati: string[]; saltati: string[] };
              alert(r.salvati.length ? `Salvati su Drive: ${r.salvati.join(', ')}` : 'Nessun preventivo accettato da salvare — erano già tutti a posto.');
              await onCambiato();
            } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
            finally { setBackfillBusy(false); }
          }}>{backfillBusy ? '…' : '📤 Recupera vecchi su Drive'}</button>}
          {puoModificare && <button className="add" onClick={onNuovoPreventivo}>＋ Nuovo preventivo</button>}
        </span>
      </div>
      <p className="empty" style={{ marginTop: -4 }}>Una cartella per ospite. Contratti e ricevute generati da qui in poi si aggiungono da soli.</p>
      <div className="filtri">
        <input className="cerca" placeholder="Cerca ospite, codice, alloggio…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={statoF} onChange={(e) => setStatoF(e.target.value)}>
          <option value="">Ogni stato</option>
          {['Bozza', 'Inviato', 'Accettato', 'Scaduto', 'Rifiutato'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {err && <p className="err">{err}</p>}

      {richieste.length > 0 && (
        <div className="docgroup">
          <h3><span>🌐 Richieste dal sito</span><span className="empty">{richieste.length} da gestire</span></h3>
          {richieste.map((r) => (
            <div key={r.id} className="docrow">
              <b>{r.nome}</b>
              <span>{r.alloggio} · {dataIt(r.checkin)}→{dataIt(r.checkout)} · {r.numeroOspiti} ospiti · {r.telefono}</span>
              {r.note && <small className="empty">{r.note}</small>}
              <span className="azioni">
                <input
                  type="number" placeholder="€/notte" style={{ width: 80 }}
                  value={prezzoRichiesta[r.id] ?? ''}
                  onChange={(e) => setPrezzoRichiesta((p) => ({ ...p, [r.id]: e.target.value }))}
                />
                <button className="mini coral" disabled={busy === r.id} onClick={() => creaPreventivoDaRichiesta(r.id)}>📄 Crea preventivo</button>
                <button className="mini" disabled={busy === r.id} onClick={() => ignoraRichiesta(r.id)}>Ignora</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {cartelle.length === 0 && <p className="empty">Nessun documento{q || statoF ? ' con questi filtri' : ' ancora'}.</p>}
      {cartelle.map((c) => (
        <div key={c.nome} className="docgroup">
          <h3><span>📁 {c.nome}</span><span className="empty">{c.righe.length + c.file.length} doc.{c.tel ? ` · ${c.tel}` : ''}</span></h3>
          {c.file.map((d) => (
            <div key={d.id} className="docrow">
              <span className="pill pill-Bozza">{d.tipo}</span>
              <span>{d.nome}</span>
              <small className="empty">{dataIt(d.caricatoIl.slice(0, 10))}</small>
              {d.driveUrl && <span className="azioni"><a className="mini" href={d.driveUrl} target="_blank" rel="noopener">📎 apri su Drive</a></span>}
            </div>
          ))}
          {c.righe.map((p) => {
            const url = `/api/nuovo/documento?tipo=preventivo&id=${p.id}`;
            const scaduto = p.stato === 'Inviato' && p.inviatoIl && (Date.now() - Date.parse(p.inviatoIl)) > p.validoOre * 3600e3;
            return (
              <div key={p.id}>
                <div className="docrow">
                  <span className={`pill pill-${p.stato}`}>{p.stato}</span>
                  <b>{p.codice}</b>
                  <span>{p.alloggio} · {dataIt(p.checkin)}→{dataIt(p.checkout)} · {eur(Number(p.totale))}</span>
                  {scaduto && <span className="pill pill-Scaduto">tempo scaduto</span>}
                  <span className="azioni">
                    <button className="mini" onClick={() => setApri(apri === p.id ? null : p.id)}>{apri === p.id ? 'chiudi' : '👁 anteprima'}</button>
                    <a className="mini" href={`${url}&download=1`} target="_blank" rel="noopener">PDF</a>
                    {p.ospiteTelefono && <a className="mini coral" href={waUrl(p)} target="_blank" rel="noopener">💬 WhatsApp</a>}
                    {puoModificare && p.stato === 'Bozza' && <button className="mini" disabled={busy === p.id} onClick={() => azione(p.id, 'stato-preventivo', 'Inviato')}>→ Inviato</button>}
                    {puoModificare && (p.stato === 'Bozza' || p.stato === 'Inviato') && <button className="mini coral" disabled={busy === p.id} onClick={() => { if (confirm(`Accettare ${p.codice}? Creo la prenotazione e blocco le date.`)) azione(p.id, 'accetta-preventivo'); }}>✓ Accettato</button>}
                    {puoModificare && (p.stato === 'Bozza' || p.stato === 'Inviato') && <button className="mini" disabled={busy === p.id} onClick={() => azione(p.id, 'stato-preventivo', 'Rifiutato')}>✕</button>}
                    {puoModificare && <button className="mini" disabled={busy === p.id} onClick={() => { if (confirm(`Eliminare del tutto il preventivo ${p.codice}? Non si può annullare.`)) azione(p.id, 'elimina-preventivo'); }}>🗑 Elimina</button>}
                  </span>
                </div>
                {apri === p.id && <iframe src={url} title={p.codice} style={{ width: '100%', height: 420, border: '1px solid var(--line)', borderRadius: 10, background: '#fff', margin: '6px 0' }} />}
              </div>
            );
          })}
        </div>
      ))}
      <p className="empty" style={{ marginTop: 10 }}>Contratti e ricevute generati dalle rispettive schede si salvano da soli su Drive e compaiono qui. I documenti creati prima del 13/09/2026 restano solo su Drive, non ancora in questo elenco.</p>
    </div>
  );
}

// ── Rendiconti proprietario ────────────────────────────────────────────────
function Rendiconti({ anagrafica, oggi }: { anagrafica: Anagrafica; oggi: string }) {
  const [propId, setPropId] = useState(anagrafica[0]?.id ?? '');
  const [ambito, setAmbito] = useState(''); // '' = tutti; 'imm:<id>' | 'all:<id>'
  const now = new Date(oggi);
  const [anno, setAnno] = useState(now.getFullYear());
  const [mese, setMese] = useState(now.getMonth() + 1);
  const [r, setR] = useState<Rendiconto | null>(null);
  const [caricando, setCaricando] = useState(false);

  const prop = anagrafica.find((p) => p.id === propId);
  const ambitoQ = ambito.startsWith('imm:') ? `&immobile=${ambito.slice(4)}` : ambito.startsWith('all:') ? `&alloggio=${ambito.slice(4)}` : '';

  useEffect(() => { setAmbito(''); }, [propId]);
  useEffect(() => {
    if (!propId) return;
    setCaricando(true);
    fetch(`/api/nuovo/rendiconto?proprietario=${propId}&anno=${anno}&mese=${mese}${ambitoQ}`)
      .then((x) => x.json()).then((d) => setR(d.ok ? d.rendiconto : null)).finally(() => setCaricando(false));
  }, [propId, anno, mese, ambitoQ]);

  const meseNome = new Date(anno, mese - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const meseBreve = (a: number, m: number) => new Date(a, m - 1).toLocaleDateString('it-IT', { month: 'long' });
  const pdfHref = `/api/nuovo/rendiconto/pdf?proprietario=${propId}&anno=${anno}&mese=${mese}${ambitoQ}`;

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
      {prop && (prop.immobili.length > 1 || prop.immobili.some((i) => i.alloggi.length > 1)) && (
        <div className="rendctl" style={{ marginTop: 8 }}>
          <select value={ambito} onChange={(e) => setAmbito(e.target.value)} style={{ minWidth: 220 }}>
            <option value="">Tutti gli immobili di {prop.nome}</option>
            {prop.immobili.map((im) => (
              <optgroup key={im.id} label={im.nome}>
                <option value={`imm:${im.id}`}>{im.nome} — tutto l&apos;immobile</option>
                {im.alloggi.map((al) => <option key={al.id} value={`all:${al.id}`}>{al.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      {caricando ? <p className="empty">Carico…</p> : !r ? <p className="empty">Nessun dato.</p> : (
        <>
          <h2>{r.proprietario} · <span style={{ textTransform: 'capitalize' }}>{meseNome}</span></h2>
          {r.ambito.tipo !== 'tutto' && <p className="sub" style={{ marginTop: -6 }}>{r.ambito.etichetta}</p>}

          <div className="kpirow">
            <div className="kpi"><span>Prenotazioni</span><b>{r.totali.numPrenotazioni}</b></div>
            <div className="kpi"><span>Incassato lordo</span><b>{eur(r.totali.lordo)}</b></div>
            <div className="kpi coral"><span>Spetta al proprietario</span><b>{eur(r.totali.nettoFinale)}</b></div>
          </div>

          <div className="tablescroll">
            <table className="tbl" style={{ marginTop: 16 }}>
              <thead><tr><th>Confronto</th><th className="num">Prenot.</th><th className="num">Lordo</th><th className="num">Netto propr.</th></tr></thead>
              <tbody>
                <tr><td><b><span style={{ textTransform: 'capitalize' }}>{meseNome}</span></b></td><td className="num strong">{r.totali.numPrenotazioni}</td><td className="num">{eur(r.totali.lordo)}</td><td className="num strong">{eur(r.totali.nettoProprietario)}</td></tr>
                <tr><td style={{ textTransform: 'capitalize' }}>Mese scorso ({meseBreve(r.confronti.meseScorso.anno, r.confronti.meseScorso.mese)})</td><td className="num">{r.confronti.meseScorso.prenotazioni}</td><td className="num">{eur(r.confronti.meseScorso.lordo)}</td><td className="num">{eur(r.confronti.meseScorso.nettoProprietario)}</td></tr>
                <tr><td>Stesso mese {anno - 1}</td><td className="num">{r.confronti.annoScorso.prenotazioni}</td><td className="num">{eur(r.confronti.annoScorso.lordo)}</td><td className="num">{eur(r.confronti.annoScorso.nettoProprietario)}</td></tr>
              </tbody>
            </table>
          </div>

          {r.righe.length === 0 ? <p className="empty" style={{ marginTop: 12 }}>Nessuna prenotazione questo mese.</p> : (
            <div className="tablescroll">
              <table className="tbl full">
                <thead><tr><th>Check-in</th><th>Ospite</th><th>Alloggio</th><th>Canale</th><th className="num">Lordo</th><th className="num">Commiss.</th><th className="num">Cedolare</th><th className="num">Pulizia</th><th className="num">Fee</th><th className="num">Netto propr.</th></tr></thead>
                <tbody>
                  {r.righe.map((x) => (
                    <tr key={x.id}>
                      <td>{dataIt(x.checkin)}</td><td>{x.ospite}</td><td>{x.alloggio}</td><td>{x.canale}</td>
                      <td className="num">{eur(Number(x.lordo))}</td><td className="num">{neg(Number(x.commissione))}</td>
                      <td className="num">{neg(Number(x.cedolare))}</td><td className="num">{neg(Number(x.costoPulizia))}</td>
                      <td className="num">{neg(Number(x.feeGestione))}</td><td className="num strong">{eur(Number(x.nettoProprietario))}</td>
                    </tr>
                  ))}
                  <tr className="tot">
                    <td colSpan={4}>Totale prenotazioni ({r.righe.length})</td>
                    <td className="num">{eur(r.totali.lordo)}</td><td className="num">{neg(r.totali.commissione)}</td>
                    <td className="num">{neg(r.totali.cedolare)}</td><td className="num">{neg(r.totali.costoPulizia)}</td>
                    <td className="num">{neg(r.totali.feeGestione)}</td><td className="num strong">{eur(r.totali.nettoProprietario)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {r.spese.length > 0 && (
            <div className="tablescroll">
              <table className="tbl" style={{ marginTop: 16 }}>
                <thead><tr><th>Spese del mese</th><th></th><th className="num">Importo</th></tr></thead>
                <tbody>
                  {r.spese.map((s) => <tr key={s.id}><td>{dataIt(s.data)} · {s.categoria}</td><td>{s.descrizione}</td><td className="num">−{eur(Number(s.importo))}</td></tr>)}
                  <tr className="tot"><td colSpan={2}>Totale spese</td><td className="num">−{eur(r.totali.totSpese)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="sub" style={{ marginTop: 8 }}>Costi di pulizia: {neg(r.totali.costoPulizia)} · Fee di gestione: {neg(r.totali.feeGestione)}</p>
          {r.totali.impostaSoggiorno > 0 && <p className="sub">Imposta di soggiorno incassata dagli ospiti (da versare al comune): {eur(r.totali.impostaSoggiorno)}</p>}

          <div className="previsione">
            <span>Previsione <span style={{ textTransform: 'capitalize' }}>{meseBreve(r.confronti.previsione.anno, r.confronti.previsione.mese)}</span></span>
            <p>Già acquisite <b>{r.confronti.previsione.acquisito.prenotazioni} prenotazioni</b> per {eur(r.confronti.previsione.acquisito.lordo)} di lordo.</p>
            <p className="empty">Stesso mese l&apos;anno scorso: {r.confronti.previsione.annoScorso.prenotazioni} prenotazioni, {eur(r.confronti.previsione.annoScorso.lordo)} di lordo.</p>
          </div>

          <div className="rendtot">
            <span>Spetta al proprietario</span>
            <b>{eur(r.totali.nettoFinale)}</b>
          </div>
          <p style={{ marginTop: 12 }}>
            <a className="sync" href={`${pdfHref}&download=1`} target="_blank" rel="noopener" style={{ textDecoration: 'none', display: 'inline-block' }}>📄 Scarica il PDF</a>
          </p>
          <p className="empty" style={{ marginTop: 8 }}>Fee di gestione: 0% (immobile di famiglia).</p>
        </>
      )}
    </div>
  );
}

// ── Sezione Calendario: griglia + Prezzi + Eventi ──────────────────────────
type EventoLoc = { id: string; titolo: string; dal: string; al: string; comune: string | null; impatto: string; note: string | null };
type PrezzoPer = { id: string; dal: string; al: string; prezzoNotte: string; note: string | null; alloggioId: string | null; alloggio: string | null };
type Blocco = { id: string; alloggioId: string; alloggio: string; checkin: string; checkout: string; nota: string | null };

async function creaBlocco(alloggioId: string, checkin: string, checkout: string, nota?: string) {
  const r = await fetch('/api/nuovo/blocchi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alloggioId, checkin, checkout, nota }) });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || 'Errore');
}
async function rimuoviBloccoApi(id: string) {
  await fetch('/api/nuovo/blocchi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rimuovi: id }) });
}

function SezioneCalendario({ dati, attive, oggi, onSel, puoModificare, onCambiato }: {
  dati: Dati; attive: Prenotazione[]; oggi: string; onSel: (p: Prenotazione) => void; puoModificare: boolean; onCambiato: () => Promise<void>;
}) {
  const [sub, setSub] = useState<'griglia' | 'prezzi' | 'eventi'>('griglia');
  const eventi = (dati.eventi ?? []) as EventoLoc[];
  const prezzi = (dati.prezzi ?? []) as PrezzoPer[];
  const blocchi = (dati.blocchi ?? []) as Blocco[];
  return (
    <>
      <div className="subtabs">
        {(['griglia', 'prezzi', 'eventi'] as const).map((s) => (
          <button key={s} className={sub === s ? 'on' : ''} onClick={() => setSub(s)}>
            {s === 'griglia' ? '📅 Calendario' : s === 'prezzi' ? `💶 Prezzi${prezzi.length ? ` (${prezzi.length})` : ''}` : `🎉 Eventi${eventi.length ? ` (${eventi.length})` : ''}`}
          </button>
        ))}
      </div>
      {sub === 'griglia' && <Calendario prenotazioni={attive} alloggi={dati.alloggi} oggi={oggi} onSel={onSel} eventi={eventi} prezzi={prezzi} blocchi={blocchi} puoModificare={puoModificare} onCambiato={onCambiato} />}
      {sub === 'prezzi' && <PannelloPrezzi prezzi={prezzi} alloggi={dati.alloggi} eventi={eventi} puoModificare={puoModificare} onCambiato={onCambiato} />}
      {sub === 'eventi' && <PannelloEventi eventi={eventi} puoModificare={puoModificare} onCambiato={onCambiato} />}
    </>
  );
}

function PannelloPrezzi({ prezzi, alloggi, eventi, puoModificare, onCambiato }: {
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

function PannelloEventi({ eventi, puoModificare, onCambiato }: {
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

// ── Calendario stile Airbnb ─────────────────────────────────────────────────
function Calendario({ prenotazioni, alloggi, oggi, onSel, eventi = [], prezzi = [], blocchi = [], puoModificare = false, onCambiato }: {
  prenotazioni: Prenotazione[]; alloggi: Alloggio[]; oggi: string; onSel: (p: Prenotazione) => void; eventi?: EventoLoc[]; prezzi?: PrezzoPer[];
  blocchi?: Blocco[]; puoModificare?: boolean; onCambiato?: () => Promise<void>;
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

  // La colonna dei nomi stanza vive FUORI dal contenitore che scorre orizzontalmente
  // (invece di provare a tenerla "sticky" dentro la griglia CSS): con CSS Grid, un
  // figlio in position:sticky si àncora alla propria cella di colonna, che scorre insieme
  // al resto — quindi la colonna finiva per sparire scrollando, non per restare ferma.
  // Separandola davvero, resta visibile per costruzione, senza bisogno di sticky.
  const alloggiAttivi = alloggi.filter((a) => a.attivo);
  return (
    <div className="card calwrap">
      <div className="calhead">
        <button onClick={() => setMeseOffset((m) => m - 1)}>‹</button>
        <h2>{label}</h2>
        <button onClick={() => setMeseOffset((m) => m + 1)}>›</button>
        {meseOffset !== 0 && <button className="oggi" onClick={() => setMeseOffset(0)}>oggi</button>}
      </div>
      <div className="cal2col">
        <div className="cal-fixed">
          <div className="cal-corner" />
          {prezzi.length > 0 && <div className="cal-room cal-prezzo">💶 €/notte</div>}
          {alloggiAttivi.map((a) => <div key={a.id} className="cal-room">{a.emoji} {a.nome}</div>)}
        </div>
        <div className="tablescroll">
          <div className="cal" style={{ ['--cell' as string]: `${CELL}px`, gridTemplateColumns: `repeat(${giorni.length}, var(--cell))` }}>
            {giorni.map((g) => {
              const d = new Date(g);
              const we = d.getDay() === 0 || d.getDay() === 6;
              const ev = eventi.find((e) => e.dal <= g && e.al >= g);
              return <div key={g} className={'cal-day' + (we ? ' we' : '') + (g === oggi ? ' today' : '') + (ev ? ' hasev' : '')} title={ev ? `🎉 ${ev.titolo}${ev.comune ? ' · ' + ev.comune : ''}` : undefined}>
                <span>{d.getDate()}</span><small>{ev ? '🎉' : d.toLocaleDateString('it-IT', { weekday: 'narrow' })}</small>
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
                puoModificare={puoModificare} onCambiato={onCambiato}
                onSel={onSel} />
            ))}
          </div>
        </div>
      </div>
      <div className="callegend">
        {Object.entries(CANALE_COLOR).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}
        <span><i style={{ background: 'repeating-linear-gradient(135deg,#888,#888 4px,#aaa 4px,#aaa 8px)' }} />Bloccato</span>
        {puoModificare && <span className="empty">— trascina su una riga vuota per bloccare/sbloccare delle notti</span>}
      </div>
    </div>
  );
}

function CalRow({ giorni, cell, alloggioId, alloggioNome, prenotazioni, prezzi = [], blocchi = [], puoModificare = false, onCambiato, onSel }: {
  giorni: string[]; cell: number; alloggioId: string; alloggioNome: string; prenotazioni: Prenotazione[]; prezzi?: PrezzoPer[];
  blocchi?: Blocco[]; puoModificare?: boolean; onCambiato?: () => Promise<void>; onSel: (p: Prenotazione) => void;
}) {
  const primo = giorni[0];
  const idx = (d: string) => Math.round((Date.parse(d) - Date.parse(primo)) / 864e5);
  const [drag, setDrag] = useState<{ start: number; end: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const occupato = (i: number) => {
    const g = giorni[i];
    return prenotazioni.some((p) => p.checkin <= g && p.checkout > g) || blocchi.some((b) => b.checkin <= g && b.checkout > g);
  };

  function iniziaSel(i: number) { if (!puoModificare || busy || occupato(i)) return; setDrag({ start: i, end: i }); }
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
        const sel = drag && i >= Math.min(drag.start, drag.end) && i <= Math.max(drag.start, drag.end);
        const cliccabile = puoModificare && !occupato(i);
        return (
          <div key={g} className={'cal-cell' + (sel ? ' selecting' : '') + (cliccabile ? ' selectable' : '')} style={{ width: cell }}
            onMouseDown={() => iniziaSel(i)} onMouseEnter={() => estendiSel(i)}>
            {pz && <span className="cal-przrow">{Math.round(Number(pz.prezzoNotte))}</span>}
          </div>
        );
      })}
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

function DettaglioPrenotazione({ p, alloggi, puoModificare, apriPagamentoSubito, onClose, onSalvato }: {
  p: Prenotazione; alloggi: Alloggio[]; puoModificare: boolean; apriPagamentoSubito?: boolean; onClose: () => void; onSalvato: () => void;
}) {
  const [modifica, setModifica] = useState(false);
  const [f, setF] = useState({ checkin: p.checkin, checkout: p.checkout, canale: p.canale, lordo: String(p.lordo), numeroOspiti: String(p.numeroOspiti || 1), stato: p.stato, note: p.note, alloggioId: alloggi.find((a) => a.nome === p.alloggio)?.id ?? '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const residuo = Math.max(0, Math.round((p.lordo - p.pagamenti.reduce((s, pg) => s + pg.importo, 0)) * 100) / 100);
  const [pag, setPag] = useState<null | { tipo: string; importo: string; metodo: string }>(
    apriPagamentoSubito && p.origine !== 'Foglio' ? { tipo: 'Saldo', importo: residuo ? String(residuo) : '', metodo: 'Contanti' } : null,
  );

  async function salvaPagamento() {
    if (!pag) return;
    setBusy(true); setErr('');
    try {
      await api('aggiungi-pagamento', { dati: { prenotazioneId: p.id, tipo: pag.tipo, importo: Number(pag.importo), metodo: pag.metodo } });
      setPag(null); onSalvato();
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  }

  async function salva() {
    setBusy(true); setErr('');
    try {
      await api('aggiorna-prenotazione', { id: p.id, dati: { checkin: f.checkin, checkout: f.checkout, canale: f.canale, lordo: Number(f.lordo), numeroOspiti: Number(f.numeroOspiti) || 1, stato: f.stato, note: f.note, alloggioId: f.alloggioId } });
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
              {p.commissione > 0 && <tr><td>Commissione</td><td className="num">{neg(p.commissione)}</td></tr>}
              {p.cedolare > 0 && <tr><td>Cedolare</td><td className="num">{neg(p.cedolare)}</td></tr>}
              <tr><td>Pulizia</td><td className="num">{neg(p.costoPulizia)}</td></tr>
              {p.feeGestione > 0 && <tr><td>Fee gestione</td><td className="num">{neg(p.feeGestione)}</td></tr>}
              <tr className="tot"><td>Utile</td><td className="num strong">{eur(p.utile)}</td></tr>
              <tr><td>Netto proprietario</td><td className="num">{eur(p.nettoProprietario)}</td></tr>
            </tbody></table>
            {p.penaleImporto != null && <p>Penale: {eur(p.penaleImporto)}</p>}
            {p.note && <p className="sub">{p.note}</p>}

            {p.pagamenti.length > 0 && (
              <table className="tbl" style={{ marginTop: 10 }}><tbody>
                <tr><td colSpan={2}><b style={{ fontSize: 13 }}>Pagamenti registrati</b></td></tr>
                {p.pagamenti.map((pg) => (
                  <tr key={pg.id}><td>{pg.tipo} · {dataIt(pg.data)}{pg.metodo ? ` · ${pg.metodo}` : ''}</td><td className="num">{eur(pg.importo)}</td></tr>
                ))}
                <tr className="tot"><td>Totale incassato</td><td className="num strong">{eur(p.pagamenti.reduce((s, pg) => s + pg.importo, 0))}</td></tr>
              </tbody></table>
            )}

            {puoModificare && (pag ? (
              <div className="form" style={{ marginTop: 10, padding: 12, background: 'var(--coral-soft)', borderRadius: 10 }}>
                <b style={{ fontSize: 13 }}>Registra un pagamento</b>
                <label>Tipo<select value={pag.tipo} onChange={(e) => setPag({ ...pag, tipo: e.target.value })}>{['Caparra', 'Saldo', 'Rimborso'].map((t) => <option key={t}>{t}</option>)}</select></label>
                <label>Importo €<input type="number" step="0.01" value={pag.importo} onChange={(e) => setPag({ ...pag, importo: e.target.value })} autoFocus /></label>
                <label>Metodo<select value={pag.metodo} onChange={(e) => setPag({ ...pag, metodo: e.target.value })}>{['Bonifico', 'Contanti', 'Carta', 'Piattaforma'].map((m) => <option key={m}>{m}</option>)}</select></label>
                <div className="modalactions">
                  <button className="add" onClick={salvaPagamento} disabled={busy || !pag.importo}>{busy ? 'salvo…' : 'Salva pagamento'}</button>
                  <button onClick={() => setPag(null)}>Annulla</button>
                </div>
              </div>
            ) : (
              <p style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a className="sync" href={`/api/nuovo/documento?tipo=conferma&prenotazione=${p.id}&download=1`} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>📄 Conferma per l&apos;ospite</a>
                {p.telefono && (() => {
                  const t = p.telefono.replace(/[^\d]/g, '');
                  const num = t.length === 10 ? '39' + t : t;
                  const saluto = new Date().getHours() < 14 ? 'Buongiorno' : 'Buonasera';
                  const primo = p.ospite.trim().split(/\s+/)[0];
                  const pdfUrl = `${window.location.origin}/api/nuovo/documento?tipo=conferma&prenotazione=${p.id}`;
                  const msg = [
                    `${saluto} ${primo}, sono Raffaele di Salzillo Hospitality.`,
                    `Ecco la conferma della tua prenotazione per ${p.alloggio}:`,
                    `Check-in ${dataIt(p.checkin)} · Check-out ${dataIt(p.checkout)}`,
                    `Qui il PDF con tutti i dettagli: ${pdfUrl}`,
                    `Per qualsiasi dubbio scrivimi pure qui.`,
                  ].join('\n');
                  return <a className="sync" href={`https://wa.me/${num}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>💬 Manda conferma su WhatsApp</a>;
                })()}
                {p.origine !== 'Foglio' && <button className="sync" onClick={() => setPag({ tipo: 'Caparra', importo: '', metodo: 'Bonifico' })}>💰 Registra pagamento</button>}
              </p>
            ))}

            {puoModificare && (
              <div className="modalactions">
                <button className="add" onClick={() => setModifica(true)}>✏️ Modifica</button>
                {p.stato === 'Attiva' && <button className="danger" onClick={() => cancella(false)} disabled={busy}>Cancella</button>}
                {p.stato === 'Attiva' && <button className="danger" onClick={() => cancella(true)} disabled={busy}>Cancella con penale</button>}
              </div>
            )}
            {p.origine === 'Foglio' && (
              <p className="empty" style={{ marginTop: 8 }}>Questa prenotazione arriva dal Google Sheet. Finché i due sistemi girano in parallelo, modificala <b>sul foglio</b>: qui la modifica verrebbe sovrascritta dalla sincronizzazione notturna.</p>
            )}
          </>
        ) : (
          <div className="form">
            <label>Alloggio<select value={f.alloggioId} onChange={(e) => setF({ ...f, alloggioId: e.target.value })}>{alloggi.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
            <label>Check-in<input type="date" value={f.checkin} onChange={(e) => setF({ ...f, checkin: e.target.value })} /></label>
            <label>Check-out<input type="date" value={f.checkout} onChange={(e) => setF({ ...f, checkout: e.target.value })} /></label>
            <label>Ospiti<input type="number" min="1" value={f.numeroOspiti} onChange={(e) => setF({ ...f, numeroOspiti: e.target.value })} /></label>
            <label>Canale<select value={f.canale} onChange={(e) => setF({ ...f, canale: e.target.value })}>{['Airbnb', 'Booking', 'Diretto', 'No Tax'].map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Lordo €<input type="number" step="0.01" value={f.lordo} onChange={(e) => setF({ ...f, lordo: e.target.value })} /></label>
            <label>Stato<select value={f.stato} onChange={(e) => setF({ ...f, stato: e.target.value })}>{['Attiva', 'In attesa di conferma', 'Cancellata', 'Cancellata con penale', 'No-show'].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Note<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            {p.origine === 'Foglio' && <p className="empty">Attenzione: prenotazione dal foglio — la modifica qui dura solo fino al prossimo sync notturno. Meglio farla sul Google Sheet.</p>}
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
        <p className="empty" style={{ marginTop: 8 }}>Crea anche l&apos;evento su Google Calendar (se l&apos;alloggio ne ha uno collegato) e si scrive sul vecchio foglio come riserva. Resta nel database anche dopo il sync dal foglio.</p>
      </div>
    </div>
  );
}

function Preventivo({ alloggi, ospiti, onClose, onSalvato }: { alloggi: Alloggio[]; ospiti: Ospite[]; onClose: () => void; onSalvato: () => Promise<void> }) {
  const [f, setF] = useState({ alloggioId: alloggi[0]?.id ?? '', ospiteId: '', checkin: '', checkout: '', ospiti: '2', prezzoNotte: '', prezzo: '', sconto: '', scontoTipo: 'euro', cliente: '', tel: '', ore: '24', note: '' });
  const [vediAnteprima, setVediAnteprima] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function scegliOspite(id: string) {
    const o = ospiti.find((x) => x.id === id);
    setF((s) => ({ ...s, ospiteId: id, cliente: o ? `${o.nome} ${o.cognome}`.trim() : s.cliente, tel: o?.telefono ?? s.tel }));
  }

  const nnotti = f.checkin && f.checkout ? Math.max(0, Math.round((Date.parse(f.checkout) - Date.parse(f.checkin)) / 864e5)) : 0;
  // quando cambia il prezzo/notte o le date, ricalcola il totale; e viceversa
  function setNotte(v: string) {
    const tot = v && nnotti ? (Number(v) * nnotti).toFixed(2) : '';
    setF((s) => ({ ...s, prezzoNotte: v, prezzo: tot }));
  }
  function setTotale(v: string) {
    const pn = v && nnotti ? (Number(v) / nnotti).toFixed(2) : '';
    setF((s) => ({ ...s, prezzo: v, prezzoNotte: pn }));
  }

  const totLordo = f.prezzo ? Number(f.prezzo) : (f.prezzoNotte && nnotti ? Number(f.prezzoNotte) * nnotti : 0);
  const scontoNum = Number(f.sconto) || 0;
  const scontoEuro = scontoNum > 0 ? (f.scontoTipo === 'percento' ? Math.round(totLordo * scontoNum) / 100 : scontoNum) : 0;
  const totFinale = Math.max(0, Math.round((totLordo - scontoEuro) * 100) / 100);

  const q = new URLSearchParams({
    tipo: 'preventivo', alloggio: f.alloggioId, checkin: f.checkin, checkout: f.checkout,
    ospiti: f.ospiti, cliente: f.cliente, tel: f.tel, ore: f.ore || '24', note: f.note,
    ...(f.prezzoNotte ? { prezzoNotte: f.prezzoNotte } : {}), ...(f.prezzo ? { prezzo: f.prezzo } : {}),
    ...(scontoNum > 0 ? { sconto: f.sconto, scontoTipo: f.scontoTipo } : {}),
  });
  const url = `/api/nuovo/documento?${q.toString()}`;
  const pronto = f.alloggioId && f.checkin && f.checkout && nnotti > 0 && (f.prezzo || f.prezzoNotte);

  const nomeAlloggio = alloggi.find((a) => a.id === f.alloggioId)?.nome ?? '';
  const telPulito = f.tel.replace(/[^\d]/g, '');
  const saluto = new Date().getHours() < 14 ? 'Buongiorno' : 'Buonasera';
  const primoNome = f.cliente ? f.cliente.trim().split(/\s+/)[0] : '';
  // WhatsApp (link wa.me gratuito) non permette di allegare un file: l'unico modo di far
  // arrivare il PDF insieme al messaggio è mettere il link diretto nel testo — l'ospite lo apre
  // con un tap, Raffaele non deve allegare nulla a mano. Un vero allegato nativo richiederebbe
  // le API Business di WhatsApp (a pagamento, verifica aziendale Meta) — vedi
  // wiki/decisioni/infrastruttura-free-first.md.
  function buildMsgWa(pdfUrl?: string) {
    return [
      `${saluto}${primoNome ? ' ' + primoNome : ''}, sono Raffaele di Salzillo Hospitality.`,
      `Ecco il preventivo per ${nomeAlloggio}:`,
      `Check-in ${f.checkin ? dataIt(f.checkin) : '—'} · Check-out ${f.checkout ? dataIt(f.checkout) : '—'} (${nnotti} notti, ${f.ospiti} ospiti)`,
      `Totale ${eur(totFinale)}${scontoEuro > 0 ? ` (sconto −${eur(scontoEuro)})` : ''}`,
      `Per bloccare le date puoi confermare entro ${f.ore || '24'} ore: fino ad allora l'alloggio resta riservato a te, dopodiché torna disponibile.`,
      `Cancellazione gratuita fino a 48h prima del check-in.`,
      pdfUrl ? `Qui il PDF con tutti i dettagli: ${pdfUrl}` : `Ti mando il PDF con tutti i dettagli a parte.`,
      `Per qualsiasi dubbio scrivimi pure qui.`,
    ].join('\n');
  }
  const waUrl = `https://wa.me/${telPulito.length >= 9 ? (telPulito.length === 10 ? '39' + telPulito : telPulito) : ''}?text=${encodeURIComponent(buildMsgWa())}`;

  async function salva() {
    setBusy(true); setErr('');
    // Apro subito una tab vuota, sincrona dentro il click — se aspettassi il salvataggio (un
    // await) prima di aprirla, i browser la trattano come popup non richiesto e la bloccano.
    // La reindirizzo su WhatsApp solo se il salvataggio va a buon fine; altrimenti la chiudo.
    const tabWa = telPulito.length >= 9 ? window.open('', '_blank', 'noopener') : null;
    try {
      const [nome, ...resto] = f.cliente.trim().split(/\s+/);
      const creato = await api('crea-preventivo', { dati: {
        alloggioId: f.alloggioId, checkin: f.checkin, checkout: f.checkout, numeroOspiti: Number(f.ospiti) || 1,
        ...(f.prezzo ? { prezzo: Number(f.prezzo) } : {}), ...(f.prezzoNotte ? { prezzoNotte: Number(f.prezzoNotte) } : {}),
        ...(scontoNum > 0 ? { sconto: scontoNum, scontoTipo: f.scontoTipo } : {}),
        validoOre: Number(f.ore) || 24, note: f.note || undefined,
        ...(f.ospiteId ? { ospiteId: f.ospiteId } : { ospiteNome: nome || undefined, ospiteCognome: resto.join(' ') || undefined, ospiteTelefono: f.tel || undefined }),
      } }) as { id: string };
      // Appena salvato, apro subito WhatsApp col messaggio già pronto e il link diretto al PDF
      // — un solo click invece di due, e niente allegato da cercare a mano. Resta comunque un
      // tap manuale per il "Invia" dentro WhatsApp: un invio del tutto senza tocchi richiede le
      // API Business di WhatsApp, non il link wa.me gratuito usato qui.
      if (tabWa) {
        const pdfUrl = `${window.location.origin}/api/nuovo/documento?tipo=preventivo&id=${creato.id}`;
        const urlConPdf = `https://wa.me/${telPulito.length === 10 ? '39' + telPulito : telPulito}?text=${encodeURIComponent(buildMsgWa(pdfUrl))}`;
        tabWa.location.href = urlConPdf;
      }
      await onSalvato();
    } catch (e) {
      if (tabWa) tabWa.close();
      setErr(e instanceof Error ? e.message : String(e)); setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>✕</button>
        <h2>Preventivo</h2>
        <div className="form">
          <label>Alloggio<select value={f.alloggioId} onChange={(e) => setF({ ...f, alloggioId: e.target.value })}>{alloggi.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
          <label>Ospite<select value={f.ospiteId} onChange={(e) => scegliOspite(e.target.value)}>
            <option value="">— nuovo, scrivo sotto —</option>
            {ospiti.map((o) => <option key={o.id} value={o.id}>{o.cognome} {o.nome}</option>)}
          </select></label>
          <label>Check-in<input type="date" value={f.checkin} onChange={(e) => setF({ ...f, checkin: e.target.value })} /></label>
          <label>Check-out<input type="date" value={f.checkout} onChange={(e) => setF({ ...f, checkout: e.target.value })} /></label>
          {nnotti > 0 && <p className="sub">= {nnotti} notti</p>}
          <label>Ospiti<input type="number" min="1" value={f.ospiti} onChange={(e) => setF({ ...f, ospiti: e.target.value })} /></label>
          <label>Prezzo a notte €<input type="number" step="0.01" value={f.prezzoNotte} onChange={(e) => setNotte(e.target.value)} /></label>
          <label>Prezzo totale € <span style={{ fontWeight: 400 }}>(o compila questo)</span><input type="number" step="0.01" value={f.prezzo} onChange={(e) => setTotale(e.target.value)} /></label>
          <label>Sconto <span style={{ fontWeight: 400 }}>(facoltativo)</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="number" step="0.01" min="0" value={f.sconto} onChange={(e) => setF({ ...f, sconto: e.target.value })} style={{ flex: 1 }} />
              <select value={f.scontoTipo} onChange={(e) => setF({ ...f, scontoTipo: e.target.value })} style={{ width: 64 }}>
                <option value="euro">€</option>
                <option value="percento">%</option>
              </select>
            </div>
          </label>
          {totLordo > 0 && <p className="sub">{scontoEuro > 0 ? `Totale scontato: ${eur(totFinale)}  (sconto −${eur(scontoEuro)})` : `Totale: ${eur(totFinale)}`}</p>}
          <label>Nome cliente<input value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} /></label>
          <label>Telefono cliente <span style={{ fontWeight: 400 }}>(per WhatsApp)</span><input type="tel" inputMode="tel" placeholder="es. 333 1234567" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></label>
          <label>Ore per confermare <span style={{ fontWeight: 400 }}>(blocco alloggio)</span><input type="number" min="1" value={f.ore} onChange={(e) => setF({ ...f, ore: e.target.value })} /></label>
          <label>Note<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        </div>
        {pronto && vediAnteprima && (
          <div style={{ marginTop: 12 }}>
            <iframe src={url} title="Anteprima preventivo" style={{ width: '100%', height: 460, border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }} />
            <p className="empty" style={{ marginTop: 4 }}>È quello che vedrà l&apos;ospite. Il PDF resta salvato: puoi ri-aprirlo quando vuoi.</p>
          </div>
        )}
        {err && <p className="err">{err}</p>}
        <div className="modalactions">
          {pronto
            ? <button className="add" onClick={() => setVediAnteprima((v) => !v)}>{vediAnteprima ? 'Nascondi anteprima' : '👁 Anteprima'}</button>
            : <button className="add" disabled>Compila i campi</button>}
          {pronto && <button className="add" onClick={salva} disabled={busy}>{busy ? 'salvo…' : telPulito.length >= 9 ? '💾 Salva e apri WhatsApp' : '💾 Salva nei documenti'}</button>}
          {pronto && telPulito.length >= 9 && <a className="sync" href={waUrl} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>💬 Riapri WhatsApp</a>}
          <button onClick={onClose}>Chiudi</button>
        </div>
        {pronto && (
          <p className="empty" style={{ marginTop: 6 }}>
            {telPulito.length >= 9
              ? 'Salvando si apre subito WhatsApp col messaggio già scritto e il link al PDF già dentro: ti resta solo da premere Invia. Lo trovi anche dopo nella scheda Documenti.'
              : 'Salvando lo trovi nella scheda Documenti, con anteprima e "segna accettato". Aggiungi il telefono per aprire WhatsApp in automatico.'}
          </p>
        )}
      </div>
    </div>
  );
}

function CalendariBox({ alloggio, onClose }: { alloggio: { id: string; nome: string }; onClose: () => void }) {
  const [cals, setCals] = useState<{ id: string; nome: string; url: string; attivo: boolean; ultimo_controllo: string | null; ultimo_esito: string | null }[]>([]);
  const [nome, setNome] = useState('Airbnb');
  const [url, setUrl] = useState('');
  const [esiti, setEsiti] = useState<null | { alloggio: string; calendario: string; mancano: { start: string; end: string; summary: string }[]; inPiu: { start: string; end: string; ospite: string }[]; errore?: string }[]>(null);
  const [busy, setBusy] = useState(false);
  const exportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/ical/${alloggio.id}.ics`;

  const [blocchi, setBlocchi] = useState<{ id: string; checkin: string; checkout: string; nota: string | null }[]>([]);
  const [bCheckin, setBCheckin] = useState('');
  const [bCheckout, setBCheckout] = useState('');
  const [bNota, setBNota] = useState('');
  const [bBusy, setBBusy] = useState(false);

  async function caricaBlocchi() { const d = await (await fetch(`/api/nuovo/blocchi?alloggio=${alloggio.id}`)).json(); if (d.ok) setBlocchi(d.blocchi); }
  useEffect(() => { caricaBlocchi(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function aggiungiBlocco() {
    setBBusy(true);
    try {
      const d = await (await fetch('/api/nuovo/blocchi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alloggioId: alloggio.id, checkin: bCheckin, checkout: bCheckout, nota: bNota }) })).json();
      if (!d.ok) { alert(d.error || 'Errore'); return; }
      setBCheckin(''); setBCheckout(''); setBNota(''); await caricaBlocchi();
    } finally { setBBusy(false); }
  }
  async function rimuoviBlocco(id: string) { await fetch('/api/nuovo/blocchi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rimuovi: id }) }); await caricaBlocchi(); }

  async function carica() { const d = await (await fetch(`/api/nuovo/calendari?alloggio=${alloggio.id}`)).json(); if (d.ok) setCals(d.calendari.filter((c: { attivo: boolean }) => c.attivo)); }
  useEffect(() => { carica(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function aggiungi() {
    setBusy(true);
    try { await fetch('/api/nuovo/calendari', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alloggioId: alloggio.id, nome, url }) }); setUrl(''); await carica(); }
    finally { setBusy(false); }
  }
  async function rimuovi(id: string) { await fetch('/api/nuovo/calendari', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rimuovi: id }) }); await carica(); }
  async function controlla() {
    setBusy(true); setEsiti(null);
    try { const d = await (await fetch(`/api/nuovo/calendari?alloggio=${alloggio.id}&controlla=1`)).json(); if (d.ok) setEsiti(d.esiti); await carica(); }
    finally { setBusy(false); }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>✕</button>
        <h2>Calendari · {alloggio.nome}</h2>

        <h3 style={{ marginTop: 10 }}>Blocca queste date su Airbnb / Booking</h3>
        <p className="sub">Copia questo link e incollalo su Airbnb (Calendario → Importa calendario) e su Booking (Sincronizza calendari). Le prenotazioni dirette e No Tax registrate qui bloccheranno quelle date anche là.</p>
        <div className="form"><label>Link da incollare
          <input readOnly value={exportUrl} onClick={(e) => { (e.target as HTMLInputElement).select(); navigator.clipboard?.writeText(exportUrl); }} />
        </label></div>

        <h3 style={{ marginTop: 16 }}>Blocca date senza prenotazione</h3>
        <p className="sub">Per uso personale, manutenzione, ecc. — niente ospite, niente importi: entra solo nel link qui sopra, quindi blocca le date anche su Airbnb/Booking come una prenotazione.</p>
        {blocchi.map((b) => (
          <div key={b.id} className="row">
            <b>{dataIt(b.checkin)} → {dataIt(b.checkout)}</b> <small style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{b.nota}</small>
            <button className="linklike" onClick={() => rimuoviBlocco(b.id)}>rimuovi</button>
          </div>
        ))}
        <div className="form">
          <label>Check-in<input type="date" value={bCheckin} onChange={(e) => setBCheckin(e.target.value)} /></label>
          <label>Check-out<input type="date" value={bCheckout} onChange={(e) => setBCheckout(e.target.value)} /></label>
          <label>Nota (facoltativa)<input value={bNota} onChange={(e) => setBNota(e.target.value)} placeholder="es. manutenzione caldaia" /></label>
        </div>
        <div className="modalactions">
          <button className="add" onClick={aggiungiBlocco} disabled={bBusy || !bCheckin || !bCheckout}>{bBusy ? '…' : 'Blocca queste date'}</button>
        </div>

        <h3 style={{ marginTop: 16 }}>Controlla i calendari OTA (per sicurezza)</h3>
        <p className="sub">Incolla qui i link iCal che Airbnb e Booking ti danno: ogni giorno il sistema controlla che le prenotazioni là e qui coincidano.</p>
        {cals.map((c) => (
          <div key={c.id} className="row">
            <b>{c.nome}</b> <small style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{c.url}</small>
            <span className="chip" style={{ background: c.ultimo_esito === 'ok' ? '#1FAA6E22' : c.ultimo_esito ? '#E5484D22' : '#8882', color: c.ultimo_esito === 'ok' ? '#1FAA6E' : c.ultimo_esito ? '#E5484D' : '#888' }}>{c.ultimo_esito || 'mai controllato'}</span>
            <button className="linklike" onClick={() => rimuovi(c.id)}>rimuovi</button>
          </div>
        ))}
        <div className="form">
          <label>Piattaforma<select value={nome} onChange={(e) => setNome(e.target.value)}><option>Airbnb</option><option>Booking</option></select></label>
          <label>Link iCal<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></label>
        </div>
        <div className="modalactions">
          <button className="add" onClick={aggiungi} disabled={busy || !/^https?:\/\//.test(url)}>Aggiungi</button>
          <button className="add" onClick={controlla} disabled={busy || cals.length === 0}>{busy ? '…' : 'Controlla adesso'}</button>
        </div>
        {esiti && esiti.map((e, i) => (
          <div key={i} style={{ marginTop: 8, fontSize: 13 }}>
            <b>{e.calendario}:</b> {e.errore ? <span className="err">errore — {e.errore}</span>
              : e.mancano.length === 0 && e.inPiu.length === 0 ? <span style={{ color: '#1FAA6E' }}>tutto coincide ✓</span>
              : <>
                {e.mancano.map((m, j) => <div key={'m' + j} className="err">📥 {dataIt(m.start)}→{dataIt(m.end)}: c&apos;è su {e.calendario}, non qui</div>)}
                {e.inPiu.map((m, j) => <div key={'p' + j} className="err">📤 {dataIt(m.start)}→{dataIt(m.end)} ({m.ospite}): qui ma non su {e.calendario}</div>)}
              </>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AlloggiatiWebBox({ schedine, onCambiato }: { schedine: SchedinaAlloggiati[]; onCambiato: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [esiti, setEsiti] = useState<Record<string, { ok: boolean; messaggio: string }>>({});

  async function invia(s: SchedinaAlloggiati) {
    if (!confirm(
      `Invio VERO e DEFINITIVO alla Polizia di Stato (Alloggiati Web) per ${s.ospiteNomeCompleto} — ${s.alloggioNome}, arrivo ${dataIt(s.checkin)}.\n\n` +
      'Non è annullabile una volta accettato dal sistema. Il sistema valida di nuovo i dati prima di inviare (Test) e invia solo se il test passa. Procedo?'
    )) return;
    setBusy(s.id);
    try {
      const r = await fetch('/api/nuovo/alloggiati/invia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schedinaId: s.id }),
      });
      const d = await r.json();
      setEsiti((e) => ({ ...e, [s.id]: { ok: !!d.ok, messaggio: d.messaggio || d.error || (d.ok ? 'Inviata.' : 'Errore sconosciuto.') } }));
      if (d.ok) await onCambiato();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card">
      <div className="cardhead"><h2>Alloggiati Web <small>({schedine.length} da inviare)</small></h2></div>
      <p className="sub">
        Invio vero e diretto al portale della Polizia di Stato — un click alla volta, mai automatico. Compaiono qui solo le
        schedine di prenotazioni <b>Il Tulipano</b> con canale <b>Airbnb, Booking o Diretto</b> (regola confermata da Raffaele
        — le prenotazioni No Tax e le altre strutture non vengono mai inviate). Prima di ogni invio il sistema rivalida i dati
        col servizio reale (Test) e invia solo se il test passa.
      </p>
      {schedine.length === 0 ? <p className="empty">Nessuna schedina da inviare al momento.</p> : schedine.map((s) => (
        <div key={s.id} className="docrow">
          <b>{s.ospiteNomeCompleto}</b>
          <span className="empty">{s.alloggioNome} · arrivo {dataIt(s.checkin)} · {s.canale}</span>
          <button className="mini coral" disabled={busy === s.id} style={{ marginLeft: 'auto' }} onClick={() => invia(s)}>
            {busy === s.id ? 'invio…' : '📨 invia adesso'}
          </button>
          {esiti[s.id] && <p className={esiti[s.id].ok ? 'empty' : 'err'} style={{ flexBasis: '100%', margin: '4px 0 0' }}>{esiti[s.id].messaggio}</p>}
        </div>
      ))}
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
/* <body> del layout ha le classi Tailwind "flex flex-col": .wrap, suo figlio diretto, è quindi
   un flex item e senza min-width:0 non si restringe mai sotto il min-content del contenuto —
   da qui il "blowout" su schermi stretti (vedi anche .card/.grid sotto). */
.wrap{min-height:100vh;width:100%;min-width:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:20px;max-width:1200px;margin:0 auto;}
.gate{display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;min-height:100vh;
  background:radial-gradient(60% 50% at 12% 15%,var(--coral-soft) 0%,transparent 60%),
    radial-gradient(50% 45% at 92% 10%,var(--coral-soft) 0%,transparent 55%),var(--bg);}
.gate::before,.gate::after{content:'';position:absolute;border-radius:50%;filter:blur(60px);pointer-events:none;}
.gate::before{width:320px;height:320px;background:var(--coral);opacity:.3;top:-100px;left:-100px;animation:gateblob1 12s ease-in-out infinite;}
.gate::after{width:260px;height:260px;background:var(--coral);opacity:.22;bottom:-90px;right:-70px;animation:gateblob2 14s ease-in-out infinite;}
@keyframes gateblob1{0%,100%{transform:translate(0,0)}50%{transform:translate(26px,32px)}}
@keyframes gateblob2{0%,100%{transform:translate(0,0)}50%{transform:translate(-22px,-28px)}}
@keyframes gaterise{from{opacity:0;transform:translateY(16px) scale(.98);}to{opacity:1;transform:translateY(0) scale(1);}}
@keyframes gatefloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
@media (prefers-reduced-motion:reduce){.gate::before,.gate::after,.gatecard,.gatemark{animation:none!important;}}
.gatecard{max-width:360px;width:100%;text-align:center;position:relative;z-index:1;padding:36px 28px 30px;
  border-radius:22px;box-shadow:0 26px 60px -22px rgba(0,0,0,.3),0 2px 10px rgba(0,0,0,.05);
  animation:gaterise .5s cubic-bezier(.2,.8,.2,1);}
.gatetema{position:absolute;top:16px;right:16px;}
.gatemark{width:56px;height:56px;margin:0 auto 14px;border-radius:16px;
  background:linear-gradient(150deg,var(--coral),#FF8F86);display:flex;align-items:center;justify-content:center;
  font-family:var(--font-jakarta),sans-serif;font-weight:800;font-size:24px;color:#fff;
  box-shadow:0 12px 26px -10px rgba(255,90,95,.6);animation:gatefloat 5s ease-in-out infinite;}
.gatecard h1{font-family:var(--font-jakarta),-apple-system,sans-serif;font-size:26px;font-weight:800;margin:3px 0 6px;letter-spacing:-.01em;}
.gatecard .field{position:relative;margin:12px 0;}
.gatecard .field .fic{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:15px;opacity:.55;pointer-events:none;}
.gatecard input{width:100%;padding:12px 14px 12px 40px;font-size:16px;border:1.5px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);transition:border-color .15s,box-shadow .15s;}
.gatecard input:focus{outline:none;border-color:var(--coral);box-shadow:0 0 0 4px var(--coral-soft);}
.gatecard button,.gatecard input{font-family:inherit}
.gatecard button[type="submit"]{width:100%;margin-top:6px;padding:13px 16px;border:none;border-radius:12px;
  background:linear-gradient(135deg,var(--coral),#FF7A73);color:#fff;font-size:15px;font-weight:800;letter-spacing:.01em;
  box-shadow:0 12px 24px -10px rgba(255,90,95,.6);transition:transform .15s,box-shadow .15s;}
.gatecard button[type="submit"]:hover{transform:translateY(-1px);box-shadow:0 16px 28px -10px rgba(255,90,95,.7);}
.gatecard button[type="submit"]:active{transform:translateY(0);}
button{cursor:pointer;font-family:inherit}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:16px;min-width:0;}
/* .grid è display:grid e .card un suo figlio: senza min-width:0 un figlio grid/flex non si
   restringe mai sotto il min-content del contenuto interno (es. una tabella larga) — anche se
   quella tabella ha già il suo .tablescroll con overflow-x:auto — e "gonfia" tutta la pagina. */
.grid{min-width:0;}
.card h2{font-family:var(--font-jakarta),-apple-system,sans-serif;font-size:17px;font-weight:800;margin:0 0 14px;letter-spacing:-.01em;display:flex;align-items:center;gap:9px;color:var(--ink);}
.card h2 small,h3 small{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12px;font-weight:500;text-transform:none;letter-spacing:0;color:var(--ink-muted);margin-left:2px;}
.ic{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;font-size:14px;font-style:normal;flex:none;}
.ic-arrivi{background:var(--coral-soft);}
.ic-partenze{background:#1D6DF022;}
.ic-mese{background:#1FAA6E22;}
.ic-occ{background:#8C7BD822;}
.ic-manca{background:#FFB23822;}
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
.chip-oggi{font-size:11px;font-weight:800;padding:2px 10px;border-radius:100px;background:var(--coral);color:#fff;letter-spacing:.03em;}
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
.cal-cell.selectable{cursor:pointer;}
.cal-cell.selectable:hover{background:var(--coral-soft);}
.cal-cell.selecting{background:var(--coral);opacity:.35;}
.cal-bar.blocco{background:repeating-linear-gradient(135deg,#7d7d7d,#7d7d7d 6px,#969696 6px,#969696 12px);cursor:pointer;}
.cal-bar:disabled{cursor:default;}
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
.cerca{width:100%;padding:10px 12px;margin:10px 0 4px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-size:15px;font-family:inherit;}
.tbl tr.clic{cursor:pointer;}
.tbl tr.clic:hover td{background:var(--coral-soft);}
.vchip{padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;}
.v-Buono{background:#1FAA6E22;color:#1FAA6E;}
.v-Neutro{background:var(--line);color:var(--ink-muted);}
.v-Problematico{background:#E5484D22;color:#E5484D;}
.kpirow{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;}
.kpi{flex:1;min-width:130px;padding:12px 14px;background:var(--surface-2,rgba(0,0,0,.03));border-radius:12px;}
.kpi span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-muted);}
.kpi b{display:block;margin-top:4px;font-size:19px;}
.kpi.coral{background:var(--coral-soft);}
.kpi.coral b{color:var(--coral);}
.previsione{margin-top:16px;padding:12px 16px;background:var(--surface-2,rgba(0,0,0,.03));border-radius:12px;}
.previsione>span{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-muted);}
.previsione p{margin:4px 0 0;font-size:13px;}
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
.tematoggle{font-size:12px;font-weight:700;padding:6px 12px;border-radius:100px;border:1px solid var(--line);background:var(--surface);color:var(--ink-muted);display:inline-flex;align-items:center;gap:5px;}
.subtabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
.subtabs button{padding:7px 13px;border:1px solid var(--line);background:var(--surface);color:var(--ink-muted);border-radius:9px;font-size:12.5px;font-weight:700;}
.subtabs button.on{background:var(--coral-soft);color:var(--coral);border-color:var(--coral);}
.azionirapide{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
.azionirapide .add{background:var(--surface);color:var(--ink);border:1px solid var(--line);}
.cal-day.hasev{background:var(--coral-soft);}
.cal-day.hasev.today{background:var(--coral);}
.cal-room.cal-prezzo{height:22px;font-size:11px;color:var(--ink-muted);}
.cal-prz{border-left:1px solid var(--line);height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--coral);}
.cal-przrow{position:absolute;top:1px;left:0;right:0;text-align:center;font-size:9px;font-weight:700;color:var(--ink-muted);opacity:.7;pointer-events:none;}
.filtri{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 4px;}
.filtri select,.filtri input{padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font-size:13px;font-family:inherit;}
.filtri .cerca{flex:1;min-width:160px;margin:0;}
.pill{font-size:11px;font-weight:700;padding:3px 9px;border-radius:100px;white-space:nowrap;}
.pill-Bozza{background:var(--line);color:var(--ink-muted);}
.pill-Inviato{background:#1D6DF022;color:#1D6DF0;}
.pill-Accettato{background:#1FAA6E22;color:#1FAA6E;}
.pill-Scaduto,.pill-Rifiutato{background:#E5484D22;color:#E5484D;}
.docgroup{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px;}
.docgroup>h3{margin:0 0 8px;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:8px;}
.docrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 0;border-top:1px solid var(--line);font-size:13px;}
.docrow:first-of-type{border-top:none;}
.docrow .azioni{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;}
.mini{font-size:12px;font-weight:700;padding:5px 10px;border-radius:100px;border:1px solid var(--line);background:var(--surface);color:var(--ink);text-decoration:none;}
.mini.coral{border-color:var(--coral);background:var(--coral-soft);color:var(--coral);}
@media (max-width:640px){
  .wrap{padding:12px;}
  .topbar h1{font-size:20px;}
  .tabs{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:none;}
  .tabs::-webkit-scrollbar{display:none;}
  .tabs button{flex:none;}
  .grid{grid-template-columns:1fr;}
  .card{padding:14px 15px;border-radius:14px;}
  .overlay{padding:0;align-items:flex-end;}
  .modal{max-width:100%;border-radius:16px 16px 0 0;max-height:94vh;}
  .topbar{align-items:stretch;}
  .topright{align-items:stretch;}
  .topright .hint{text-align:right;}
}
`;
