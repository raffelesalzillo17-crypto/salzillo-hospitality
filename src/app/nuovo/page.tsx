'use client';

import { useEffect, useState } from 'react';
import { LinkUtiliBox, SezioneCalendario } from './componenti/calendario';
import { CollaboratoriBox } from './componenti/collaboratori';
import { Documenti } from './componenti/documenti';
import { AlloggiatiWebBox, CalendariBox, SinfoniaBox } from './componenti/integrazioni';
import { DettaglioPrenotazione, FormPrenotazione } from './componenti/prenotazione';
import { FormPreventivo } from './componenti/preventivo';
import { RigaPulizia } from './componenti/pulizie';
import { Rendiconti } from './componenti/rendiconti';
import { FormModale, TemaToggle } from './componenti/ui';
import { CSS } from './stili';
import type { Campo, Dati, Prenotazione, Scadenza } from './tipi';
import { CANALE_COLOR, TAB_LABEL, api, dataIt, eur } from './utilita';


/* Anteprima del NUOVO sistema Salzillo Hospitality (database).
   Non è ancora la fonte viva — Raffaele continua a usare il Google Sheet, che il database
   insegue via il cron /api/cron/sync-db. Qui si guarda com'è e si verifica che i dati
   tornino. Stessa identità visiva di Motore Rafilu (corallo→magenta).
   Vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md (fasi 4-5). */


export default function Nuovo() {
  const [sess, setSess] = useState<{ nome: string; ruolo: string; vedeFinanziario: boolean; puoModificare: boolean } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const [primoAccesso, setPrimoAccesso] = useState(false);
  const [pa, setPa] = useState({ codice: '', username: '', password: '' });
  const [paOk, setPaOk] = useState(false);
  const [dati, setDati] = useState<Dati | null>(null);
  const [errore, setErrore] = useState('');
  const [tab, setTab] = useState<'dashboard' | 'calendario' | 'prenotazioni' | 'ospiti' | 'documenti' | 'immobili' | 'spese' | 'scadenze' | 'pulizie' | 'alloggiati' | 'rendiconti' | 'link' | 'guida'>('dashboard');
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
        {(['dashboard', 'calendario', 'prenotazioni', 'ospiti', 'documenti', 'immobili', 'spese', 'scadenze', 'pulizie', 'alloggiati', 'rendiconti', 'link', 'guida'] as const)
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

      {tab === 'rendiconti' && <Rendiconti anagrafica={dati.anagrafica} oggi={oggi} documenti={dati.documenti ?? []} />}

      {tab === 'link' && <LinkUtiliBox link={dati.linkUtili ?? []} puoModificare={sess.puoModificare} onCambiato={carica} />}

      {tab === 'documenti' && <Documenti preventivi={dati.preventivi ?? []} documenti={dati.documenti ?? []} richieste={dati.richieste ?? []} ospiti={dati.ospiti} puoModificare={sess.puoModificare} ruoloTitolare={sess.ruolo === 'Titolare'} onCambiato={carica} onNuovoPreventivo={() => setPreventivo(true)} />}

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
              <li><b>Immobili</b> — proprietari, immobili, alloggi. Da qui si aggiungono, si modificano ed eliminano (🗑️, solo Titolare, solo se non hanno ancora nulla di vero agganciato). Creando un alloggio si apre subito il collegamento calendari Airbnb/Booking</li>
              <li><b>Spese</b> — i costi. <b>Scadenze</b> — raggruppate per ente/regione, col pulsante &quot;Scadenze tipiche&quot;</li>
              <li><b>Pulizie</b> — quelle di check-out si aggiungono da sole; &quot;Pulizia extra&quot; per richieste in più durante il soggiorno. Visibili anche come pallino 🧹 sul Calendario (clicca per confermare chi ha pulito). Da qui il Titolare gestisce anche &quot;Chi ha accesso al sistema&quot; (inviti, permessi, eliminazione operatori)</li>
              <li><b>Alloggiati Web</b> (solo Titolare) — invio vero e diretto alla Polizia di Stato, un click alla volta. Compaiono solo le schedine Il Tulipano con canale Airbnb/Booking/Diretto; il sistema rivalida i dati (Test) prima di ogni invio reale (Send)</li>
              <li><b>Rendiconti</b> — quanto spetta a ogni proprietario, con confronto e previsione, PDF pronto da mandare. La voce &quot;Tutti i proprietari&quot; (solo Titolare) somma tutto insieme, per il quadro generale</li>
              <li><b>Link utili</b> — rubrica di link comodi (sito vetrina, check-in, WhatsApp, e quelli che aggiungi tu) da avere a portata di mano e condividere</li>
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
                <span style={{ display: 'flex', gap: 8 }}>
                  {sess.puoModificare && <button className="add" onClick={() => setModale({ titolo: `Nuovo immobile di ${pr.nome}`, azione: 'crea-immobile', campi: [
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
        <AlloggiatiWebBox schedine={dati.schedineAlloggiati ?? []} daVerificare={dati.schedineDaVerificare ?? []} onCambiato={carica} />
      )}

      {prenSel && <DettaglioPrenotazione p={prenSel} alloggi={dati.alloggi} puoModificare={sess.puoModificare}
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

