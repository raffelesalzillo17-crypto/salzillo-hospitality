'use client';

import { useEffect, useState } from 'react';
import type { SchedinaAlloggiati, SchedinaDaVerificare } from '../tipi';
import { api, dataIt } from '../utilita';

export function CalendariBox({ alloggio, onClose }: { alloggio: { id: string; nome: string }; onClose: () => void }) {
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

export function AlloggiatiWebBox({ schedine, daVerificare, onCambiato }: { schedine: SchedinaAlloggiati[]; daVerificare: SchedinaDaVerificare[]; onCambiato: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [esiti, setEsiti] = useState<Record<string, { ok: boolean; messaggio: string }>>({});
  const [risolviBusy, setRisolviBusy] = useState<string | null>(null);

  async function risolvi(s: SchedinaDaVerificare, esito: 'Inviata' | 'Da inviare') {
    const messaggioConferma = esito === 'Inviata'
      ? `Confermi di aver verificato SUL PORTALE ALLOGGIATI WEB che la schedina di ${s.nome} ${s.cognome} risulta già inviata? Non farlo a intuito.`
      : `Confermi che la schedina di ${s.nome} ${s.cognome} NON è mai arrivata ad Alloggiati Web e va rimessa tra le "da inviare"?`;
    if (!confirm(messaggioConferma)) return;
    setRisolviBusy(s.id);
    try {
      await api('risolvi-schedina-ambigua', { id: s.id, dati: { esito } });
      await onCambiato();
    } finally {
      setRisolviBusy(null);
    }
  }
  const [dataRicevuta, setDataRicevuta] = useState(() => new Date().toISOString().slice(0, 10));
  const [ricevutaBusy, setRicevutaBusy] = useState(false);
  const [ricevutaErr, setRicevutaErr] = useState('');
  const [ricevutaEsito, setRicevutaEsito] = useState('');

  async function scaricaRicevuta() {
    setRicevutaBusy(true); setRicevutaErr(''); setRicevutaEsito('');
    try {
      const r = await fetch('/api/nuovo/alloggiati/ricevuta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: dataRicevuta }),
      });
      const d = await r.json();
      if (!d.ok) { setRicevutaErr(d.error || 'Errore'); return; }
      const bin = atob(d.pdfBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `ricevuta-alloggiati-${dataRicevuta}.pdf`; a.click();
      URL.revokeObjectURL(url);
      // Come per preventivi/contratti: salvata anche nella cartella Drive di ciascun ospite
      // coperto da questa ricevuta, e comparirà nella scheda "Preventivi" → gruppo dell'ospite.
      const salvate: string[] = d.salvateSuDrive || [];
      const nonSalvate: string[] = d.nonSalvateSuDrive || [];
      if (salvate.length > 0) setRicevutaEsito(`Salvata su Drive per: ${salvate.join(', ')} — la trovi nella scheda Preventivi, sotto ciascun ospite.`);
      if (nonSalvate.length > 0) setRicevutaErr(`Scaricata, ma NON salvata su Drive per: ${nonSalvate.join('; ')}`);
    } catch (e) {
      setRicevutaErr(String(e instanceof Error ? e.message : e));
    } finally {
      setRicevutaBusy(false);
    }
  }

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
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: 12 }}>
        <b style={{ fontSize: 13 }}>📄 Ricevuta del giorno</b>
        <input type="date" value={dataRicevuta} onChange={(e) => setDataRicevuta(e.target.value)} />
        <button className="mini" disabled={ricevutaBusy} onClick={scaricaRicevuta}>{ricevutaBusy ? 'scarico…' : '⬇️ Scarica PDF'}</button>
        {ricevutaErr && <p className="err" style={{ flexBasis: '100%', margin: '4px 0 0' }}>{ricevutaErr}</p>}
        {ricevutaEsito && <p className="empty" style={{ flexBasis: '100%', margin: '4px 0 0' }}>{ricevutaEsito}</p>}
      </div>
      <p className="empty" style={{ marginTop: -6, marginBottom: 12 }}>
        Obbligo distinto dall&apos;invio: la Polizia emette una ricevuta per ogni giorno in cui è stato fatto almeno un invio vero — va conservata. Il portale la emette solo per i giorni con un invio reale già effettuato.
      </p>
      {daVerificare.length > 0 && (
        <div style={{ background: 'var(--coral-soft)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <b style={{ fontSize: 13 }}>⚠️ Da verificare ({daVerificare.length})</b>
          <p className="empty" style={{ margin: '4px 0 10px' }}>
            Schedine con esito incerto — non risultano più &quot;da inviare&quot; ma non sono state confermate come inviate.
            Controlla sul portale Alloggiati Web prima di scegliere: non tocca mai da sola nulla in automatico.
          </p>
          {daVerificare.map((s) => (
            <div key={s.id} className="docrow">
              <b>{s.nome} {s.cognome}</b>
              <span className="empty">{s.alloggioNome} · arrivo {dataIt(s.checkin)} · stato: {s.stato}</span>
              {s.esitoInvio && <span className="empty" style={{ flexBasis: '100%' }}>{s.esitoInvio}</span>}
              <button className="mini" disabled={risolviBusy === s.id} onClick={() => risolvi(s, 'Inviata')}>✓ era già inviata</button>
              <button className="mini" disabled={risolviBusy === s.id} onClick={() => risolvi(s, 'Da inviare')}>↺ segna da rifare</button>
            </div>
          ))}
        </div>
      )}
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

export function SinfoniaBox({ immobileId, oggi, onClose }: { immobileId: string; oggi: string; onClose: () => void }) {
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
