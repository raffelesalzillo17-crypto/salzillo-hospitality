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
import { CANALI } from '@/lib/canali';
import { Rendiconti } from './componenti/rendiconti';
import { ResocontoAnnuale } from './componenti/resoconto';
import { FormModale, TemaToggle } from './componenti/ui';
import { SezioneRegistro } from './componenti/registro';
import { SezioneOspiti } from './componenti/ospiti';
import { SezioneAdempimenti } from './componenti/adempimenti';
import { SezioneSpese } from './componenti/spese';
import { SezioneScadenze } from './componenti/scadenze';
import { RiepilogoDashboard, CosaManca } from './componenti/dashboard';
import { CSS } from './stili';
import type { Campo, Dati, Prenotazione, Scadenza } from './tipi';
import { CANALE_COLOR, TAB_LABEL, api, dataIt, eur, scaricaTabella } from './utilita';


/* Anteprima del NUOVO sistema Salzillo Hospitality (database).
   Non è ancora la fonte viva — Raffaele continua a usare il Google Sheet, che il database
   insegue via il cron /api/cron/sync-db. Qui si guarda com'è e si verifica che i dati
   tornino. Stessa identità visiva di Motore Rafilu (corallo→magenta).
   Vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md (fasi 4-5). */


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
          <h1>Nuovo sistema <span className="beta">anteprima</span></h1>
        </div>
        <div className="topright">
          <span className="hint">👤 {sess.nome} · <button className="linklike" onClick={copiaLinkPersonale} title="Il tuo link per entrare da un altro telefono o computer">🔗 il mio link</button> · <button className="linklike" onClick={logout}>esci</button></span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <TemaToggle />
            {sess.ruolo === 'Titolare' && <button className="sync" onClick={aggiorna} disabled={syncing}>{syncing ? 'aggiorno…' : '↻ aggiorna dal foglio'}</button>}
          </div>
        </div>
      </header>

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
            <h2><i className="ic ic-occ">🏠</i>Occupazione <small>adesso</small></h2>
            <p className="big">{occupatiOggi.length} / {dati.alloggi.filter((a) => a.attivo).length} <small>alloggi occupati</small></p>
            {occupatiOggi.map((p) => (
              <div key={p.id} className="row" onClick={() => setPrenSel(p)}>
                <span className="chip" style={{ background: (CANALE_COLOR[p.canale] || '#888') + '22', color: CANALE_COLOR[p.canale] || '#888' }}>{p.alloggio}</span>
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
              <li><b>Dashboard</b> — in alto il riepilogo di tutti gli immobili per mese (frecce per cambiare mese, filtro per proprietario): incasso lordo, commissioni OTA, netto al proprietario, spese, tassa di soggiorno riscossa, occupazione e prezzo medio a notte, ciascuno con la sua spiegazione. Gli importi sono gli stessi dei Rendiconti dello stesso mese. Poi chi arriva e parte e “Cosa manca” diviso in blocchi: pagamenti da incassare (7 giorni), pulizie di oggi e domani, scadenze (30 giorni), schedine mancanti o in ritardo, sovrapposizioni di calendario</li>
              <li><b>Calendario</b> — vista stile Airbnb: righe = alloggi, barre colorate = prenotazioni. Due viste, <b>Mese</b> e <b>Settimana</b> (la settimana parte dal lunedì; da telefono si apre la settimana, che sta tutta sullo schermo), pulsante <b>Oggi</b>. Passando col mouse (o toccando, da telefono) su una prenotazione compare un’anteprima con ospite, notti, canale e stato del pagamento. Per bloccare delle notti trascini su una riga vuota (da telefono: tocchi il primo e l’ultimo giorno) e ti viene sempre chiesta conferma. In alto compare un avviso se ci sono sovrapposizioni con i calendari Airbnb/Booking. Prezzi per data e alloggio solo per il Titolare. Sotto-schede <b>Prezzi</b> (prezzo/notte consigliato per periodo) ed <b>Eventi</b> (sagre, fiere, ponti — i giorni con eventi si evidenziano)</li>
              <li><b>Prenotazioni</b> — l&apos;elenco completo con ricerca e filtri. Da qui crei una prenotazione o un preventivo. Click su una riga → dettagli, modifica, registra pagamento</li>
              <li><b>Ospiti</b> — l&apos;anagrafica. Cerca per nome, telefono o email; filtra per valutazione, ultimo soggiorno e numero di soggiorni; “storico” mostra tutti i soggiorni di una persona; ↔ scambia nome e cognome. Telefono, email e codice fiscale vengono controllati (telefono in formato internazionale, +39 se manca). Il Titolare ha “Possibili duplicati”: sceglie il record principale e unisce, le prenotazioni passano tutte sul principale; i record di prova si possono nascondere senza eliminarli</li>
              <li><b>Preventivi</b> — Bozza → Inviato → Accettato. "Converti in prenotazione" crea la prenotazione con gli stessi dati e dice se qualcosa differisce. Un preventivo accettato è <b>bloccato</b>: non si modifica né si elimina; se i dati cambiano crei una <b>nuova versione</b> (copia in Bozza). Se in seguito la prenotazione cambia importo, date o ospiti, sotto il preventivo compare l’elenco delle differenze. Gli altri si eliminano con conferma e restano 30 giorni nel cestino</li>
              <li><b>Documenti ospiti</b> (Titolare e operatore) — una cartella per ospite con i file su Drive (contratti, ricevute…). I documenti d’identità li vede solo il Titolare</li>
              <li><b>Promemoria</b> — regole che preparano messaggi (WhatsApp o email) per gli ospiti. Una regola può avere una <b>condizione</b>: solo se mancano i documenti, solo se la caparra o il saldo non sono incassati (non vale per Airbnb/Booking). "Per prenotazione" mostra, per ogni arrivo, cosa è <b>Pronto</b>, <b>Inviato</b>, <b>Bloccato</b> (con il motivo, per esempio manca il telefono) o <b>Non necessario</b>. Nessun messaggio parte da solo: lo invii tu e tocchi "Inviato". "Aggiungi i modelli pronti" crea 5 regole già scritte, spente: le accendi tu</li>
              <li><b>Export e resoconto annuale</b> — in Prenotazioni i tasti "Excel" e "CSV" scaricano l'elenco con i filtri attivi, totale compreso (senza accesso ai dati finanziari non escono gli importi). In Rendiconti, sotto il rendiconto, c'è il <b>Resoconto annuale</b>: per ogni mese prenotazioni, incasso lordo, tassa di soggiorno, notti e occupazione; incassi per canale; tassa per alloggio e mese; confronto con l'anno prima. Usa le stesse regole della Dashboard (prenotazioni attive per mese di check-in), quindi i numeri coincidono. Excel a 4 fogli o CSV</li>
              <li><b>Canali</b> — oltre ad Airbnb, Booking, Diretto e No Tax ci sono <b>WhatsApp</b>, <b>Telefono</b> e <b>Altro</b>: si comportano come Diretto (nessuna commissione, caparra e saldo da incassare, contratto e ricevuta). Compaiono nel modulo prenotazione, nei filtri, nelle regole dei promemoria e nei resoconti. "No Tax" resta com'è</li>
              <li><b>Immobili</b> — proprietari, immobili, alloggi. Da qui si aggiungono, si modificano ed eliminano (🗑️, solo Titolare, solo se non hanno ancora nulla di vero agganciato). Creando un alloggio si apre subito il collegamento calendari Airbnb/Booking. Da "calendari" di ogni alloggio: il link da incollare su Airbnb e Booking (con segreto, rigenerabile), i link iCal da importare (uno o più, con etichetta), "Sincronizza ora" e il registro delle sincronizzazioni. Le prenotazioni importate sono segnaposto "da completare"; se una sparisce dal calendario dell'OTA viene segnata "da verificare" (mai cancellata) e le sovrapposizioni compaiono in Dashboard</li>
              <li><b>Spese</b> — i costi, con foto o PDF della ricevuta allegati. Il Titolare può importare un estratto conto in CSV (anteprima, categoria abbinata, niente duplicati), impostare le spese ricorrenti (si registrano da sole) ed esportare per il commercialista in Excel o CSV, per anno e per proprietario: incassi, commissioni, spese, tassa di soggiorno. Le spese entrano nei Rendiconti e abbassano l&apos;utile. <b>Scadenze</b> — una per ente/regione, con ricorrenza automatica (si rinnova da sola quando la segni fatta). Stati: aperta, fatta (con data ed eventuale ricevuta) o non più applicabile (con il motivo): le archiviate stanno nell&apos;Archivio e non compaiono in Dashboard. Il Titolare ha &quot;Doppioni&quot; per unire le scadenze scritte due volte, con anteprima</li>
              <li><b>Pulizie</b> — si segnano “fatte” solo dal giorno del check-out (prima restano “in arrivo”), con conferma in due passaggi (tocco e poi “Confermi?”) e un annullo di 10 secondi; per ognuna puoi assegnare l’addetto, l’orario, le note e spuntare la checklist dell’alloggio (la modifichi dalla scheda Immobili). Se nello stesso alloggio arriva un ospite lo stesso giorno la pulizia è segnata urgente, anche in Dashboard. Quelle di check-out si aggiungono da sole; &quot;Pulizia extra&quot; per richieste in più durante il soggiorno. Visibili anche come pallino 🧹 sul Calendario (clicca per confermare chi ha pulito). Da qui il Titolare gestisce anche &quot;Chi ha accesso al sistema&quot; (inviti, permessi, eliminazione operatori)</li>
              <li><b>Alloggiati Web</b> (solo Titolare) — invio vero e diretto alla Polizia di Stato, un click alla volta. Compaiono solo le schedine Il Tulipano con canale Airbnb/Booking/Diretto; il sistema rivalida i dati (Test) prima di ogni invio reale (Send). Dal 23/11/2026 l’invio si blocca se le schedine non sono tante quanti gli ospiti scritti nella prenotazione: correggi il numero di ospiti o aggiungi la schedina mancante (si può forzare solo da &quot;invia comunque&quot;, con un avviso, e resta nel Registro)</li>
              <li><b>Rendiconti</b> — quanto spetta a ogni proprietario, con confronto e previsione, PDF pronto da mandare. La voce &quot;Tutti i proprietari&quot; (solo Titolare) somma tutto insieme, per il quadro generale</li>
              <li><b>Adempimenti</b> (solo Titolare) — gli arrivi del periodo con lo stato delle schedine per Alloggiati Web (da preparare, pronta, inviata, con errore), il file nel tracciato ufficiale da scaricare e caricare tu sul portale, “segna inviata” a mano e lo stato mensile di Sinfonia. Niente parte da solo. In Dashboard, sotto “Cosa manca”, compaiono le schedine mancanti o in ritardo (termine: 24 ore dall’arrivo)</li>
              <li><b>Registro</b> (solo Titolare) — il cestino (ospiti e preventivi eliminati si recuperano per 30 giorni), il registro di chi ha fatto cosa e quando, e il controllo che le cartelle Drive con i documenti non siano condivise pubblicamente, e la proposta di cancellare le copie dei documenti d’identità dopo l’invio ad Alloggiati Web (come chiede il Garante privacy). Compaiono solo le prenotazioni con tutte le schedine inviate e la ricevuta salvata: per salvarla usa &quot;Ricevuta del giorno&quot; in Alloggiati Web. La ricevuta resta sempre; confermi tu, una prenotazione alla volta</li>
              <li><b>Link utili</b> — rubrica di link comodi (sito vetrina, check-in, WhatsApp, e quelli che aggiungi tu) da avere a portata di mano e condividere</li>
            </ul>
            <p className="empty" style={{ marginTop: 8 }}><b>Chi può fare cosa.</b> <b>Titolare</b>: tutto. <b>Operatore</b> (Collaboratore): prenotazioni, calendario, ospiti, pagamenti e pulizie; non elimina niente, non tocca prezzi e impostazioni, e vede i numeri dei documenti solo come ••••1234. <b>Addetto pulizie</b>: vede e conferma solo le pulizie. La password WiFi e il numero completo di un documento si vedono solo dal Titolare, con il pulsante &quot;mostra&quot;, e ogni visualizzazione resta nel Registro.</p>
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
              <b>Il vecchio sito è spento (23/11/2026).</b> Aprendo l&apos;indirizzo principale si arriva automaticamente qui, e il vecchio modulo &quot;Nuova prenotazione&quot; non scrive più nulla: tutto si fa da questo gestionale.
            </p>
            <p className="empty" style={{ marginTop: 8 }}>
              Esiste anche un link di sola visualizzazione, senza login, da condividere con chi deve solo vedere il calendario (es. la famiglia): mostra chi arriva/parte e i dettagli di ogni prenotazione, senza poter modificare nulla. Chiedi a Raffaele il link se ti serve.
            </p>
          </div>
        </div>
      )}

      {tab === 'adempimenti' && sess.ruolo === 'Titolare' && <SezioneAdempimenti oggi={oggi} onCambiato={carica} />}

      {tab === 'registro' && sess.ruolo === 'Titolare' && <SezioneRegistro dati={dati} onCambiato={carica} />}

      {tab === 'calendario' && <SezioneCalendario dati={dati} attive={attive} oggi={oggi} onSel={setPrenSel} puoModificare={sess.puoModificare} titolare={sess.ruolo === 'Titolare'} onCambiato={carica} />}

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
                {CANALI.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 8px' }}>
              {(['xlsx', 'csv'] as const).map((fmt) => (
                <button key={fmt} className="mini" disabled={lista.length === 0} onClick={() => {
                  const conSoldi = sess.vedeFinanziario;
                  const notti = (p: typeof lista[number]) => Math.max(0, Math.round((Date.parse(p.checkout) - Date.parse(p.checkin)) / 864e5));
                  const intest = ['Check-in', 'Check-out', 'Notti', 'Ospite', 'Alloggio', 'Canale', 'Ospiti', 'Stato', ...(conSoldi ? ['Lordo', 'Utile', 'Incassato', 'Da incassare'] : [])];
                  const incassato = (p: typeof lista[number]) => p.pagamenti.reduce((s, x) => s + (x.tipo === 'Rimborso' ? -x.importo : x.importo), 0);
                  const righe: (string | number | null)[][] = lista.map((p) => [p.checkin, p.checkout, notti(p), p.ospite, p.alloggio, p.canale, p.numeroOspiti, p.stato,
                    ...(conSoldi ? [p.lordo, p.utile, incassato(p), Math.max(0, p.lordo - incassato(p))] : [])]);
                  if (conSoldi) righe.push(['Totale (' + lista.length + ')', '', '', '', '', '', '', '', somma.lordo, somma.utile, '', '']);
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
                    <div key={a.id} className="row" onClick={() => sess.ruolo === 'Titolare' && setModale({ titolo: `Modifica ${a.nome}`, azione: 'aggiorna-alloggio', id: a.id, campi: [
                      { k: 'nome', label: 'Nome' },
                      { k: 'regimeFiscale', label: 'Regime fiscale', tipo: 'select', opzioni: [{ v: 'No tax', t: 'No tax' }, { v: 'Con cedolare', t: 'Con cedolare' }] },
                      { k: 'costoPulizia', label: 'Costo pulizia €', tipo: 'number' },
                      { k: 'attivo', label: 'Attivo', tipo: 'checkbox' },
                      { k: 'wifiSsid', label: 'WiFi rete' }, { k: 'wifiPassword', label: 'WiFi password (lascia vuoto per non cambiarla)' },
                      { k: 'trasmetteAlloggiati', label: 'Trasmette ad Alloggiati Web', tipo: 'checkbox' },
                      { k: 'trasmetteRegione', label: 'Trasmette al portale regionale', tipo: 'checkbox' },
                      { k: 'impostaSoggiornoComune', label: 'Imposta soggiorno — comune' },
                      { k: 'checklistPulizie', label: 'Checklist pulizie (una voce per riga; vuoto = biancheria, cortesia, rifornimenti)', tipo: 'textarea' },
                      { k: 'impostaSoggiornoImporto', label: 'Imposta soggiorno — €/persona/notte', tipo: 'number' },
                    ], iniziali: {
                      nome: a.nome, regimeFiscale: a.regime_fiscale, costoPulizia: a.costo_pulizia, attivo: a.attivo,
                      wifiSsid: a.wifi_ssid, wifiPassword: '', trasmetteAlloggiati: a.trasmette_alloggiati,
                      trasmetteRegione: a.trasmette_regione, impostaSoggiornoComune: a.imposta_soggiorno_comune,
                      impostaSoggiornoImporto: a.imposta_soggiorno_importo, checklistPulizie: a.checklist_pulizie ?? '',
                    } })} style={{ cursor: sess.ruolo === 'Titolare' ? 'pointer' : 'default' }}>
                      <b>{a.emoji} {a.nome}</b>
                      <span className="chip" style={{ background: a.regime_fiscale === 'Con cedolare' ? '#1FAA6E22' : '#8C7BD822', color: a.regime_fiscale === 'Con cedolare' ? '#1FAA6E' : '#8C7BD8' }}>{a.regime_fiscale}</span>
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

