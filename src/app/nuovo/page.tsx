'use client';

import { useEffect, useState } from 'react';
import { LinkUtiliBox, SezioneCalendario } from './componenti/calendario';
import { CollaboratoriBox } from './componenti/collaboratori';
import { Documenti } from './componenti/documenti';
import { AlloggiatiWebBox, CalendariBox, SinfoniaBox } from './componenti/integrazioni';
import { DettaglioPrenotazione, FormPrenotazione } from './componenti/prenotazione';
import { FormPreventivo } from './componenti/preventivo';
import { RigaPulizia } from './componenti/pulizie';
import { PromemoriaBox } from './componenti/promemoria';
import { CANALI_SCELTA } from '@/lib/canali';
import { MigrazioneNoTax } from './componenti/migrazioneNoTax';
import { Guida } from './componenti/guida';
import { Rendiconti } from './componenti/rendiconti';
import { ResocontoAnnuale } from './componenti/resoconto';
import { FormModale, StileToggle, TemaToggle } from './componenti/ui';
import { SezioneRegistro } from './componenti/registro';
import { SezioneOspiti } from './componenti/ospiti';
import { SezioneAdempimenti } from './componenti/adempimenti';
import { SezioneSpese } from './componenti/spese';
import { SezioneScadenze } from './componenti/scadenze';
import { RiepilogoDashboard, CosaManca } from './componenti/dashboard';
import { CSS } from './stili';
import type { Campo, Dati, Prenotazione, Scadenza } from './tipi';
import { CANALE_COLOR, TAB_LABEL, TAB_URL, api, dataIt, eur, scaricaTabella } from './utilita';


/* Gestionale Salzillo Hospitality. Il database è la fonte ufficiale dei dati (punto 16, 23/11/2026); i fogli Google sono
   solo una copia di sicurezza in uscita. Stessa identità visiva di Motore Rafilu (corallo→magenta).
   Vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md (fasi 4-5). */


/** Etichetta ben visibile sulle prenotazioni esenti da imposte (regime fiscale, punto 3): si vede a colpo d'occhio dove non si pagano tasse. */
function ChipRegime({ p }: { p: Prenotazione }) {
  if (p.regimePrenotazione === 'No Tax') return <span className="chip" style={{ background: '#8C7BD833', color: '#8C7BD8', marginLeft: 6 }} title="Esente da ogni imposta: niente cedolare, tassa di soggiorno, Alloggiati né ricevuta">🚫 No Tax</span>;
  if (p.regimePrenotazione === 'Esente da tassa di soggiorno') return <span className="chip" style={{ background: '#C97A1633', color: '#C97A16', marginLeft: 6 }} title={p.regimeMotivo ?? 'Esente da tassa di soggiorno'}>esente tassa sogg.</span>;
  return null;
}

export default function Nuovo() {
  const [sess, setSess] = useState<{ nome: string; ruolo: string; vedeFinanziario: boolean; puoModificare: boolean } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dati, setDati] = useState<Dati | null>(null);
  const [errore, setErrore] = useState('');
  const [tab, setTab] = useState<'dashboard' | 'calendario' | 'prenotazioni' | 'ospiti' | 'documenti' | 'immobili' | 'spese' | 'scadenze' | 'pulizie' | 'promemoria' | 'alloggiati' | 'rendiconti' | 'link' | 'guida' | 'registro' | 'adempimenti' | 'documentiospiti'>('dashboard');
  const [prenSel, setPrenSel] = useState<Prenotazione | null>(null);
  const [prenSelAzione, setPrenSelAzione] = useState<'pagamento' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [nuovaPren, setNuovaPren] = useState(false);
  const [preventivo, setPreventivo] = useState(false);
  const [sinfoniaImm, setSinfoniaImm] = useState<string | null>(null);
  const [calAlloggio, setCalAlloggio] = useState<{ id: string; nome: string } | null>(null);
  const [modale, setModale] = useState<null | { titolo: string; campi: Campo[]; azione: string; id?: string; iniziali?: Record<string, unknown> }>(null);
  const [fPren, setFPren] = useState({ q: '', stato: '', alloggio: '', canale: '', regime: '', periodo: 'futuro' });
  const [menuAltro, setMenuAltro] = useState(false);
  // Punto 15 (23/11/2026): ogni sezione ha un indirizzo (/nuovo/calendario, /nuovo/prenotazioni/<id>) e i filtri stanno nell'indirizzo.
  const [urlPronto, setUrlPronto] = useState(false);
  const [idDaAprire, setIdDaAprire] = useState<string | null>(null);
  const [nonTrovata, setNonTrovata] = useState(false);

  // Stile vetro liquido di default, subito (anche mentre i dati si caricano e nella pagina di accesso); "classico" solo se scelto con il pulsante in alto.
  useEffect(() => {
    try { if (localStorage.getItem('sh_stile') !== 'classico') document.documentElement.setAttribute('data-stile', 'glass'); } catch { /* */ }
  }, []);

  useEffect(() => {
    const leggiUrl = () => {
      const [t, id] = window.location.pathname.split('/').filter(Boolean).slice(1);
      const q = new URLSearchParams(window.location.search);
      if (t && (TAB_URL as readonly string[]).includes(t)) setTab(t as typeof tab);
      else if (!t) setTab('dashboard');
      setFPren({ q: q.get('q') ?? '', stato: q.get('stato') ?? '', alloggio: q.get('alloggio') ?? '', canale: q.get('canale') ?? '', regime: q.get('regime') ?? '', periodo: q.get('periodo') ?? 'futuro' });
      setIdDaAprire(t === 'prenotazioni' && id ? id : null);
      if (!(t === 'prenotazioni' && id)) { setPrenSel(null); setNonTrovata(false); }
    };
    leggiUrl();
    setUrlPronto(true);
    window.addEventListener('popstate', leggiUrl);
    return () => window.removeEventListener('popstate', leggiUrl);
  }, []);

  // aperta da un link: appena i dati ci sono, apre la scheda di quella prenotazione
  useEffect(() => {
    if (!idDaAprire || !dati) return;
    const p = dati.prenotazioni.find((x) => x.id === idDaAprire);
    if (p) { setPrenSel(p); setNonTrovata(false); } else setNonTrovata(true);
    setIdDaAprire(null);
  }, [idDaAprire, dati]);

  // l'indirizzo segue la sezione, la prenotazione aperta e i filtri
  useEffect(() => {
    if (!urlPronto || !sess) return;
    const filtri = new URLSearchParams();
    if (tab === 'prenotazioni') {
      if (fPren.q) filtri.set('q', fPren.q);
      if (fPren.stato) filtri.set('stato', fPren.stato);
      if (fPren.alloggio) filtri.set('alloggio', fPren.alloggio);
      if (fPren.canale) filtri.set('canale', fPren.canale);
      if (fPren.regime) filtri.set('regime', fPren.regime);
      if (fPren.periodo !== 'futuro') filtri.set('periodo', fPren.periodo);
    }
    const percorso = prenSel ? `/nuovo/prenotazioni/${prenSel.id}` : tab === 'dashboard' ? '/nuovo' : `/nuovo/${tab}`;
    const q = filtri.toString();
    const nuovo = percorso + (q ? `?${q}` : '');
    if (nuovo === window.location.pathname + window.location.search) return;
    if (window.location.pathname === percorso) window.history.replaceState(null, '', nuovo); // solo i filtri cambiano
    else window.history.pushState(null, '', nuovo);
  }, [urlPronto, sess, tab, prenSel, fPren]);

  async function inviaModale(vals: Record<string, unknown>) {
    if (!modale) return;
    const azioneFatta = modale.azione;
    const r = await api(azioneFatta, { id: modale.id, dati: vals });
    setModale(null);
    await carica();
    // Appena registrato un nuovo alloggio, apri subito il collegamento calendari (invece di
    // dover tornare a cercarlo dopo) — richiesto esplicitamente da Raffaele il 20/09/2026.
    if (azioneFatta === 'crea-alloggio' && r && typeof r === 'object' && 'id' in r && 'nome' in r) {
      setCalAlloggio(r as { id: string; nome: string });
    }
  }

  async function carica() {
    const d = await (await fetch('/api/nuovo/dati')).json();
    if (d.ok) {
      setDati(d); setSess(d.sessione);
      // L'addetto pulizie vede solo le pulizie: parte da lì (punto 5, 23/11/2026).
      if (d.sessione?.ruolo === 'Pulizie') setTab((t) => (t === 'pulizie' || t === 'guida' ? t : 'pulizie'));
    } else setErrore(d.error || 'Errore');
  }

  useEffect(() => {
    fetch('/api/nuovo/dati').then((r) => r.json()).then((d) => {
      if (d.ok) { setDati(d); setSess(d.sessione); }
    }).finally(() => setAuthChecked(true));
  }, []);

  // Link personale: l'unico modo di entrare (niente username e password). Da qui chi è già
  // dentro copia il proprio, per i preferiti o per un altro dispositivo.
  async function copiaLinkPersonale() {
    const d = await (await fetch('/api/nuovo/link-personale')).json();
    if (!d.ok) { alert(d.error || 'Errore'); return; }
    const avviso = 'Aprilo sul telefono o sul computer dove vuoi usare l\'app: trovi il pulsante per entrare e le istruzioni per installarla.\n\nChi ha questo link entra come te: non mandarlo a nessuno.';
    try { await navigator.clipboard.writeText(d.url); alert(`Il tuo link personale è stato copiato.\n\n${avviso}`); }
    catch { prompt(`Copia il tuo link personale.\n\n${avviso}`, d.url); }
  }
  async function logout() {
    if (!confirm('Uscire da questo dispositivo? Per rientrare ti servirà il tuo link personale.')) return;
    await fetch('/api/nuovo/logout', { method: 'POST' }); setSess(null); setDati(null);
  }

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
          <p className="sub" style={{ textAlign: 'center' }}>
            Per entrare apri il <b>tuo link personale</b>: non servono username e password.
          </p>
          <p className="sub" style={{ textAlign: 'center' }}>
            Non lo trovi più o non funziona? Chiedine uno nuovo a Raffaele.
          </p>
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
          <h1>Gestionale</h1>
        </div>
        <div className="topright">
          <span className="hint">👤 {sess.nome} · <button className="linklike" onClick={copiaLinkPersonale} title="Il tuo link per entrare da un altro telefono o computer">🔗 il mio link</button> · <button className="linklike" onClick={logout}>esci</button></span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <StileToggle />
            <TemaToggle />
          </div>
        </div>
      </header>

      {nonTrovata && <p className="err">La prenotazione del link non esiste o non è tra quelle che puoi vedere.</p>}
      <nav className="tabs">
        {(['dashboard', 'calendario', 'prenotazioni', 'ospiti', 'documenti', 'immobili', 'spese', 'scadenze', 'pulizie', 'promemoria', 'alloggiati', 'rendiconti', 'link', 'guida', 'registro', 'adempimenti', 'documentiospiti'] as const)
          .filter((t) => t !== 'alloggiati' || sess.ruolo === 'Titolare')
          .filter((t) => t !== 'documentiospiti' || sess.ruolo === 'Titolare' || (sess.ruolo === 'Collaboratore' && sess.vedeFinanziario))
          .filter((t) => t !== 'adempimenti' || sess.ruolo === 'Titolare')
          .filter((t) => t !== 'registro' || sess.ruolo === 'Titolare')
          .filter((t) => sess.ruolo !== 'Pulizie' || t === 'pulizie' || t === 'guida')
          .filter((t) => t !== 'promemoria' || !!dati.promemoria)
          .map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {TAB_LABEL[t] ?? t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
      </nav>
      {(() => {
        const visibili = TAB_URL.filter((t) => t !== 'alloggiati' || sess.ruolo === 'Titolare')
          .filter((t) => t !== 'documentiospiti' || sess.ruolo === 'Titolare' || (sess.ruolo === 'Collaboratore' && sess.vedeFinanziario))
          .filter((t) => t !== 'adempimenti' && t !== 'registro' || sess.ruolo === 'Titolare')
          .filter((t) => sess.ruolo !== 'Pulizie' || t === 'pulizie' || t === 'guida')
          .filter((t) => t !== 'promemoria' || !!dati.promemoria);
        const principali = visibili.filter((t) => ['dashboard', 'calendario', 'prenotazioni', 'pulizie'].includes(t));
        const altri = visibili.filter((t) => !principali.includes(t));
        return (
          <>
            {menuAltro && <div className="altromenu">{altri.map((t) => <button key={t} onClick={() => { setTab(t); setMenuAltro(false); }}>{TAB_LABEL[t] ?? t[0].toUpperCase() + t.slice(1)}</button>)}</div>}
            <div className="bottomnav">
              {principali.map((t) => <button key={t} className={tab === t && !menuAltro ? 'on' : ''} onClick={() => { setTab(t); setMenuAltro(false); }}>{TAB_LABEL[t] ?? t[0].toUpperCase() + t.slice(1)}</button>)}
              {altri.length > 0 && <button className={menuAltro ? 'on' : ''} onClick={() => setMenuAltro(!menuAltro)}>Altro ▾</button>}
            </div>
          </>
        );
      })()}

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
          {sess.ruolo !== 'Pulizie' && <RiepilogoDashboard dati={dati} oggi={oggi} ruoloTitolare={sess.ruolo === 'Titolare'} />}
          <div className="card">
            <h2><i className="ic ic-arrivi">🛬</i>Arrivi <small>prossimi 7 giorni</small></h2>
            {arrivi.length === 0 ? <p className="empty">Nessun arrivo.</p> : arrivi.map((p) => (
              <div key={p.id} className="row" onClick={() => setPrenSel(p)}>
                {p.checkin === oggi
                  ? <span className="chip-oggi">OGGI</span>
                  : <b>{dataIt(p.checkin)}</b>}
                <span>{p.ospite}</span>
                <span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.alloggio}</span>
                <ChipRegime p={p} />
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
                <ChipRegime p={p} />
              </div>
            ))}
          </div>
          <div className="card">
            <h2><i className="ic ic-occ">🏠</i>Occupazione <small>adesso</small></h2>
            <p className="big">{occupatiOggi.length} / {dati.alloggi.filter((a) => a.attivo).length} <small>alloggi occupati</small></p>
            {occupatiOggi.map((p) => (
              <div key={p.id} className="row" onClick={() => setPrenSel(p)}>
                <span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.alloggio}</span>
                <ChipRegime p={p} />
                <span>{p.ospite}</span> <small>fino al {dataIt(p.checkout)}</small>
              </div>
            ))}
          </div>
          {sess.ruolo !== 'Pulizie' && <CosaManca dati={dati} ruoloTitolare={sess.ruolo === 'Titolare'} onApriPrenotazione={(id) => { const p = dati.prenotazioni.find((x) => x.id === id); if (p) setPrenSel(p); }} onVai={(t) => setTab(t as typeof tab)} />}
        </div>
        </>
      )}

      {tab === 'promemoria' && dati.promemoria && <PromemoriaBox promemoria={dati.promemoria} alloggi={dati.alloggi} puoModificare={sess.puoModificare} ruoloTitolare={sess.ruolo === 'Titolare'} onCambiato={carica} />}

      {tab === 'rendiconti' && <Rendiconti anagrafica={dati.anagrafica} oggi={oggi} documenti={dati.documenti ?? []} />}
      {tab === 'rendiconti' && sess.vedeFinanziario && <ResocontoAnnuale oggi={oggi} />}

      {tab === 'link' && <LinkUtiliBox link={dati.linkUtili ?? []} puoModificare={sess.puoModificare} onCambiato={carica} />}

      {tab === 'documenti' && <Documenti sezione="preventivi" preventivi={dati.preventivi ?? []} documenti={dati.documenti ?? []} richieste={dati.richieste ?? []} ospiti={dati.ospiti} puoModificare={sess.puoModificare} ruoloTitolare={sess.ruolo === 'Titolare'} onCambiato={carica} onNuovoPreventivo={() => setPreventivo(true)} />}
      {tab === 'documentiospiti' && <Documenti sezione="documenti" preventivi={dati.preventivi ?? []} documenti={dati.documenti ?? []} richieste={dati.richieste ?? []} ospiti={dati.ospiti} puoModificare={sess.puoModificare} ruoloTitolare={sess.ruolo === 'Titolare'} onCambiato={carica} onNuovoPreventivo={() => setPreventivo(true)} />}

      {tab === 'guida' && <Guida />}

      {tab === 'adempimenti' && sess.ruolo === 'Titolare' && <SezioneAdempimenti oggi={oggi} onCambiato={carica} />}

      {tab === 'registro' && sess.ruolo === 'Titolare' && <SezioneRegistro dati={dati} onCambiato={carica} />}

      {tab === 'calendario' && <SezioneCalendario dati={dati} attive={attive} oggi={oggi} onSel={setPrenSel} puoModificare={sess.puoModificare} titolare={sess.ruolo === 'Titolare'} onCambiato={carica} />}

      {tab === 'prenotazioni' && sess.ruolo === 'Titolare' && dati.prenotazioni.some((p) => p.canale === 'No Tax') && <MigrazioneNoTax presenti={dati.prenotazioni.filter((p) => p.canale === 'No Tax').length} onCambiato={carica} />}

      {tab === 'prenotazioni' && (() => {
        const q = fPren.q.trim().toLowerCase();
        const lista = dati.prenotazioni.filter((p) => {
          if (q && !`${p.ospite} ${p.alloggio} ${p.canale} ${p.note ?? ''}`.toLowerCase().includes(q)) return false;
          if (fPren.stato && p.stato !== fPren.stato) return false;
          if (fPren.alloggio && p.alloggio !== fPren.alloggio) return false;
          if (fPren.canale && p.canale !== fPren.canale) return false;
          if (fPren.regime && (p.regimePrenotazione ?? 'Ordinario') !== fPren.regime) return false;
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
                {[...CANALI_SCELTA, ...(dati.prenotazioni.some((p) => p.canale === 'No Tax') ? ['No Tax'] : [])].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={fPren.regime} onChange={(e) => setFPren({ ...fPren, regime: e.target.value })}>
                <option value="">Ogni regime fiscale</option>
                <option value="No Tax">🚫 No Tax (esenti da ogni imposta)</option>
                <option value="Esente da tassa di soggiorno">Esenti da tassa di soggiorno</option>
                <option value="Ordinario">Ordinario (con cedolare)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 8px' }}>
              {(['xlsx', 'csv'] as const).map((fmt) => (
                <button key={fmt} className="mini" disabled={lista.length === 0} onClick={() => {
                  const conSoldi = sess.vedeFinanziario;
                  const notti = (p: typeof lista[number]) => Math.max(0, Math.round((Date.parse(p.checkout) - Date.parse(p.checkin)) / 864e5));
                  const intest = ['Check-in', 'Check-out', 'Notti', 'Ospite', 'Alloggio', 'Canale', 'Regime fiscale', 'Ospiti', 'Stato', ...(conSoldi ? ['Lordo', 'Utile', 'Incassato', 'Da incassare'] : [])];
                  const incassato = (p: typeof lista[number]) => p.pagamenti.reduce((s, x) => s + (x.tipo === 'Rimborso' ? -x.importo : x.importo), 0);
                  const righe: (string | number | null)[][] = lista.map((p) => [p.checkin, p.checkout, notti(p), p.ospite, p.alloggio, p.canale, p.regimePrenotazione ?? 'Ordinario', p.numeroOspiti, p.stato,
                    ...(conSoldi ? [p.lordo, p.utile, incassato(p), Math.max(0, p.lordo - incassato(p))] : [])]);
                  if (conSoldi) righe.push(['Totale (' + lista.length + ')', '', '', '', '', '', '', '', '', somma.lordo, somma.utile, '', '']);
                  scaricaTabella('prenotazioni', fmt, intest, righe).catch((e) => alert(e instanceof Error ? e.message : String(e)));
                }}>{fmt === 'xlsx' ? '⬇ Excel' : '⬇ CSV'}</button>
              ))}
              <small className="empty">Scarica le {lista.length} prenotazioni mostrate, con i filtri attivi.</small>
            </div>
            <div className="tablescroll">
              <table className="tbl full">
                <thead><tr><th>Check-in</th><th>Check-out</th><th>Ospite</th><th>Alloggio</th><th>Canale</th><th className="num">Lordo</th><th className="num">Utile</th><th>Stato</th></tr></thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.id} onClick={() => setPrenSel(p)}>
                      <td>{dataIt(p.checkin)}</td><td>{dataIt(p.checkout)}</td><td>{p.ospite}{p.regimePrenotazione && p.regimePrenotazione !== 'Ordinario' ? <div><ChipRegime p={p} /></div> : null}</td><td>{p.alloggio}</td>
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

      {tab === 'ospiti' && <SezioneOspiti dati={dati} sess={sess} setModale={setModale} onCambiato={carica} />}

      {tab === 'immobili' && (
        <div className="grid">
          {sess.puoModificare && (
            <div className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="add" onClick={async () => {
                try {
                  const d = await (await fetch('/api/nuovo/calendari?tutti=1')).json();
                  if (!d.ok) throw new Error(d.error || 'Errore');
                  const e = d.esiti as { importate: unknown[]; conflitti: unknown[]; inPiu: unknown[]; errore?: string }[];
                  alert(`Sincronizzati ${e.length} calendari: ${e.reduce((n, x) => n + x.importate.length, 0)} prenotazioni importate, ${e.reduce((n, x) => n + x.conflitti.length, 0)} sovrapposizioni, ${e.reduce((n, x) => n + x.inPiu.length, 0)} da verificare, ${e.filter((x) => x.errore).length} errori.`);
                  await carica();
                } catch (err) { alert(err instanceof Error ? err.message : String(err)); }
              }}>🔄 Sincronizza tutti i calendari</button>
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
                <span style={{ display: 'flex', gap: 8 }}>
                  {sess.ruolo === 'Titolare' && <button className="add" onClick={() => setModale({ titolo: `Nuovo immobile di ${pr.nome}`, azione: 'crea-immobile', campi: [
                    { k: 'proprietarioId', label: 'Proprietario', tipo: 'select', opzioni: dati.anagrafica.map((x) => ({ v: x.id, t: x.nome })) },
                    { k: 'nome', label: 'Nome (es. Via Clanio 60)', req: true }, { k: 'indirizzo', label: 'Indirizzo', req: true },
                    { k: 'comune', label: 'Comune', req: true }, { k: 'provincia', label: 'Provincia', req: true },
                    { k: 'cin', label: 'CIN' }, { k: 'cir', label: 'CIR' },
                  ], iniziali: { proprietarioId: pr.id, comune: 'Marcianise', provincia: 'CE' } })}>＋ Immobile</button>}
                  {sess.ruolo === 'Titolare' && (
                    <button className="mini" title="Elimina proprietario" onClick={async () => {
                      if (!confirm(`Eliminare per sempre il proprietario "${pr.nome}"? Funziona solo se non ha ancora nessun immobile/utente/contratto agganciato.`)) return;
                      try { await api('elimina-proprietario', { id: pr.id }); await carica(); }
                      catch (e) { alert(e instanceof Error ? e.message : String(e)); }
                    }}>🗑️</button>
                  )}
                </span>
              </div>
              {pr.immobili.map((im) => (
                <div key={im.id} className="imm">
                  <div className="cardhead"><h3>{im.nome} <small>· {im.comune}{im.cin ? ` · CIN ${im.cin}` : ''}</small></h3>
                    {sess.ruolo === 'Titolare' && im.alloggi.length === 0 && (
                      <button className="mini" title="Elimina immobile" onClick={async () => {
                        if (!confirm(`Eliminare per sempre l'immobile "${im.nome}"? Funziona solo se non ha spese/scadenze agganciate.`)) return;
                        try { await api('elimina-immobile', { id: im.id }); await carica(); }
                        catch (e) { alert(e instanceof Error ? e.message : String(e)); }
                      }}>🗑️</button>
                    )}
                    {sess.ruolo === 'Titolare' && im.alloggi.some((a) => a.trasmette_regione) && <button className="add" onClick={() => setSinfoniaImm(im.id)}>Sinfonia</button>}
                    {sess.ruolo === 'Titolare' && <button className="add" onClick={() => setModale({ titolo: `Nuovo alloggio in ${im.nome}`, azione: 'crea-alloggio', campi: [
                      { k: 'immobileId', label: 'Immobile', tipo: 'select', opzioni: pr.immobili.map((x) => ({ v: x.id, t: x.nome })) },
                      { k: 'nome', label: 'Nome (es. Il Tulipano)', req: true },
                      { k: 'regimeFiscale', label: 'Regime fiscale (alloggio)', tipo: 'select', opzioni: [{ v: 'No tax', t: 'Senza cedolare' }, { v: 'Con cedolare', t: 'Con cedolare secca' }] },
                      { k: 'costoPulizia', label: 'Costo pulizia €', tipo: 'number' },
                      { k: 'wifiSsid', label: 'WiFi rete' }, { k: 'wifiPassword', label: 'WiFi password' },
                      { k: 'trasmetteAlloggiati', label: 'Trasmette ad Alloggiati Web', tipo: 'checkbox' },
                      { k: 'trasmetteRegione', label: 'Trasmette al portale regionale (Sinfonia)', tipo: 'checkbox' },
                      { k: 'impostaSoggiornoComune', label: 'Tassa di soggiorno — comune (vuoto = non dovuta)' },
                      { k: 'impostaSoggiornoImporto', label: 'Tassa di soggiorno — € per persona a notte', tipo: 'number' },
                    ], iniziali: { immobileId: im.id, costoPulizia: 20 } })}>＋ Alloggio</button>}
                  </div>
                  {im.alloggi.map((a) => (
                    <div key={a.id} className="row" onClick={() => sess.ruolo === 'Titolare' && setModale({ titolo: `Modifica ${a.nome}`, azione: 'aggiorna-alloggio', id: a.id, campi: [
                      { k: 'nome', label: 'Nome' },
                      { k: 'regimeFiscale', label: 'Regime fiscale (alloggio)', tipo: 'select', opzioni: [{ v: 'No tax', t: 'Senza cedolare' }, { v: 'Con cedolare', t: 'Con cedolare secca' }] },
                      { k: 'costoPulizia', label: 'Costo pulizia €', tipo: 'number' },
                      { k: 'attivo', label: 'Attivo', tipo: 'checkbox' },
                      { k: 'wifiSsid', label: 'WiFi rete' }, { k: 'wifiPassword', label: 'WiFi password (lascia vuoto per non cambiarla)' },
                      { k: 'trasmetteAlloggiati', label: 'Trasmette ad Alloggiati Web', tipo: 'checkbox' },
                      { k: 'trasmetteRegione', label: 'Trasmette al portale regionale', tipo: 'checkbox' },
                      { k: 'impostaSoggiornoComune', label: 'Tassa di soggiorno — comune' },
                      { k: 'checklistPulizie', label: 'Checklist pulizie (una voce per riga; vuoto = biancheria, cortesia, rifornimenti)', tipo: 'textarea' },
                      { k: 'impostaSoggiornoImporto', label: 'Tassa di soggiorno — € per persona a notte', tipo: 'number' },
                    ], iniziali: {
                      nome: a.nome, regimeFiscale: a.regime_fiscale, costoPulizia: a.costo_pulizia, attivo: a.attivo,
                      wifiSsid: a.wifi_ssid, wifiPassword: '', trasmetteAlloggiati: a.trasmette_alloggiati,
                      trasmetteRegione: a.trasmette_regione, impostaSoggiornoComune: a.imposta_soggiorno_comune,
                      impostaSoggiornoImporto: a.imposta_soggiorno_importo, checklistPulizie: a.checklist_pulizie ?? '',
                    } })} style={{ cursor: sess.ruolo === 'Titolare' ? 'pointer' : 'default' }}>
                      <b>{a.emoji} {a.nome}</b>
                      <span className="chip" style={{ background: a.regime_fiscale === 'Con cedolare' ? '#1FAA6E22' : '#8C7BD822', color: a.regime_fiscale === 'Con cedolare' ? '#1FAA6E' : '#8C7BD8' }}>{a.regime_fiscale === 'Con cedolare' ? 'con cedolare secca' : 'senza cedolare'}</span>
                      {a.imposta_soggiorno_comune && <small>tassa soggiorno {a.imposta_soggiorno_comune}</small>}
                      {!a.attivo && <small>non attivo</small>}
                      {sess.ruolo === 'Titolare' && <button className="linklike" style={{ marginLeft: 'auto' }} onClick={(e) => { e.stopPropagation(); setCalAlloggio({ id: a.id, nome: a.nome }); }}>📅 calendari</button>}
                      {sess.ruolo === 'Titolare' && a.wifi_password_impostata && (
                        <button className="linklike" title="Mostra la password WiFi (viene registrato)" onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const r = await (await fetch('/api/nuovo/rivela', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'wifi', id: a.id }) })).json();
                            if (!r.ok) throw new Error(r.error || 'Errore');
                            window.prompt(`Password WiFi di ${a.nome} (la visualizzazione è stata registrata):`, r.valore);
                          } catch (err) { alert(err instanceof Error ? err.message : String(err)); }
                        }}>🔑 mostra password</button>
                      )}
                      {sess.ruolo === 'Titolare' && (
                        <button className="mini" title="Elimina alloggio" onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Eliminare per sempre l'alloggio "${a.nome}"? Funziona solo se non ha prenotazioni/pulizie/preventivi agganciati.`)) return;
                          try { await api('elimina-alloggio', { id: a.id }); await carica(); }
                          catch (err) { alert(err instanceof Error ? err.message : String(err)); }
                        }}>🗑️</button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'spese' && <SezioneSpese dati={dati} sess={sess} oggi={oggi} onCambiato={carica} />}

      {tab === 'scadenze' && <SezioneScadenze dati={dati} sess={sess} oggi={oggi} setModale={setModale} onCambiato={carica} />}

      {tab === 'pulizie' && (() => {
        const tutte = dati.pulizie ?? [];
        const operatori = dati.operatoriPulizie ?? [];
        const puoGestire = sess.ruolo !== 'Proprietario';
        // Una pulizia è "da fare" solo dal giorno del check-out (punto 9, 23/11/2026): quelle future si vedono ma non si possono segnare
        const daFareTutte = tutte.filter((pu) => !pu.confermataIl).sort((a, b) => a.data.localeCompare(b.data));
        const daFare = daFareTutte.filter((pu) => pu.data <= oggi);
        const inArrivo = daFareTutte.filter((pu) => pu.data > oggi);
        const fatte = tutte.filter((pu) => pu.confermataIl).slice(0, 20);
        return (
          <>
          <div className="card">
            <div className="cardhead">
              <h2>Pulizie <small>({daFare.length} da fare{inArrivo.length ? `, ${inArrivo.length} in arrivo` : ''})</small></h2>
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
            {daFare.length === 0 ? <p className="empty">Nessuna pulizia da fare oggi.</p> : daFare.map((pu) => (
              <RigaPulizia key={pu.id} pu={pu} operatori={operatori} oggi={oggi} puoGestire={puoGestire} ruolo={sess.ruolo} onCambiato={carica} />
            ))}
            {inArrivo.length > 0 && <>
              <h3 style={{ marginTop: 16 }}><span>In arrivo <small>(si fanno dal giorno del check-out)</small></span></h3>
              {inArrivo.map((pu) => <RigaPulizia key={pu.id} pu={pu} operatori={operatori} oggi={oggi} puoGestire={puoGestire} ruolo={sess.ruolo} onCambiato={carica} />)}
            </>}
            <h3 style={{ marginTop: 16 }}><span>Fatte di recente</span></h3>
            {fatte.length === 0 ? <p className="empty">Nessuna pulizia ancora confermata.</p> : fatte.map((pu) => (
              <div key={pu.id} className="docrow">
                <span className="pill pill-Accettato">{dataIt(pu.data)}</span>
                <b>{pu.alloggio}</b>
                <span className="empty">{pu.addettoNome ? `fatta da ${pu.addettoNome}` : 'fatta'} il {new Date(pu.confermataIl!).toLocaleDateString('it-IT')}</span>
                {pu.confermataIl && pu.confermataIl.slice(0, 10) < pu.data && <span className="chip" style={{ background: '#FFB23822', color: '#C97A16' }} title="Segnata fatta prima del giorno del check-out">fatta in anticipo</span>}
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
        <AlloggiatiWebBox schedine={dati.schedineAlloggiati ?? []} daVerificare={dati.schedineDaVerificare ?? []} inviate={dati.inviiAlloggiati ?? []} onCambiato={carica} />
      )}

      {prenSel && <DettaglioPrenotazione p={dati.prenotazioni.find((x) => x.id === prenSel.id) ?? prenSel} alloggi={dati.alloggi} puoModificare={sess.puoModificare} puoVedereDocumenti={sess.ruolo === 'Titolare'}
        onCambiato={carica}
        apriPagamentoSubito={prenSelAzione === 'pagamento'}
        onClose={() => { setPrenSel(null); setPrenSelAzione(null); }}
        onSalvato={async () => { setPrenSel(null); setPrenSelAzione(null); await carica(); }} />}
      {nuovaPren && <FormPrenotazione alloggi={dati.alloggi} ospiti={dati.ospiti}
        onClose={() => setNuovaPren(false)} onSalvato={async () => { setNuovaPren(false); await carica(); }} />}
      {modale && <FormModale titolo={modale.titolo} campi={modale.campi} iniziali={modale.iniziali}
        onInvia={inviaModale} onClose={() => setModale(null)} />}
      {preventivo && <FormPreventivo alloggi={dati.alloggi} ospiti={dati.ospiti} onClose={() => setPreventivo(false)} onSalvato={async () => { setPreventivo(false); await carica(); setTab('documenti'); }} />}
      {sinfoniaImm && <SinfoniaBox immobileId={sinfoniaImm} oggi={oggi} onClose={() => setSinfoniaImm(null)} />}
      {calAlloggio && <CalendariBox alloggio={calAlloggio} onClose={() => setCalAlloggio(null)} />}
    </div>
  );
}

