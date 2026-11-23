'use client';

import { useState } from 'react';
import type { Alloggio, AttivitaPromemoria, Promemoria, PromemoriaPrenotazione, RegolaPromemoria, RigaMessaggioPrenotazione } from '../tipi';
import { api } from '../utilita';
import { FormModale } from './ui';
import { CANALI as ELENCO_CANALI } from '@/lib/canali';

// Promemoria e messaggi automatici (motore di regole, vedi src/lib/regole.ts): in alto cosa c'è
// da fare adesso, sotto le regole che li generano (modificabili dal titolare), in fondo lo
// storico. Nessun messaggio parte da solo verso gli ospiti: qui si prepara il testo e si apre
// WhatsApp con un tocco.

const EVENTI = [
  { v: 'Check-in', t: 'Check-in' },
  { v: 'Check-out', t: 'Check-out' },
  { v: 'Conferma prenotazione', t: 'Conferma della prenotazione' },
];
const AZIONI = [
  { v: 'Messaggio ospite', t: 'Messaggio per l\'ospite (WhatsApp)' },
  { v: 'Promemoria per me', t: 'Promemoria per me' },
];
const CANALI = [{ v: 'tutti', t: 'Tutti i canali' }, ...ELENCO_CANALI.map((c) => ({ v: c, t: c }))];

const CONDIZIONI = [
  { v: 'nessuna', t: 'Sempre (nessuna condizione)' },
  { v: 'documenti-mancanti', t: 'Solo se mancano i documenti d\'identità' },
  { v: 'caparra-da-incassare', t: 'Solo se la caparra non è stata incassata' },
  { v: 'saldo-da-incassare', t: 'Solo se resta un saldo da incassare' },
];
const ETICHETTA_CONDIZIONE: Record<string, string> = {
  'documenti-mancanti': 'solo se mancano i documenti', 'caparra-da-incassare': 'solo se la caparra non è incassata', 'saldo-da-incassare': 'solo se resta un saldo',
};
const COLORE_STATO: Record<string, string> = {
  Pronto: '#1FAA6E', Inviato: '#8A8A8A', 'In programma': '#3B82C4', Bloccato: '#C97A16', 'Non necessario': '#8A8A8A', Saltato: '#8A8A8A',
};

function quando(r: Pick<RegolaPromemoria, 'offsetGiorni' | 'evento' | 'ora'>): string {
  const n = Math.abs(r.offsetGiorni);
  const rif = r.evento === 'Conferma prenotazione' ? 'della conferma' : r.evento === 'Check-in' ? 'del check-in' : 'del check-out';
  const giorni = r.offsetGiorni === 0 ? `Il giorno ${rif}` : `${n} ${n === 1 ? 'giorno' : 'giorni'} ${r.offsetGiorni < 0 ? 'prima' : 'dopo'} ${rif}`;
  return `${giorni}, alle ${r.ora}`;
}

const fmtScadenza = (iso: string) => new Date(iso).toLocaleString('it-IT', {
  timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});
const ggmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function CardAttivita({ a, puoModificare, onCambiato }: { a: AttivitaPromemoria; puoModificare: boolean; onCambiato: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [copiato, setCopiato] = useState(false);
  const [adesso] = useState(() => Date.now()); // fissato al primo disegno: niente chiamate impure nel render
  const scaduta = new Date(a.scadenza).getTime() <= adesso;
  const aperta = a.stato === 'Da fare' || a.stato === 'Notificata';

  async function segna(stato: 'Fatta' | 'Saltata' | 'Da fare') {
    setBusy(true);
    try { await api('segna-attivita', { id: a.id, dati: { stato } }); await onCambiato(); } finally { setBusy(false); }
  }
  async function copia() {
    try { await navigator.clipboard.writeText(a.testo); setCopiato(true); setTimeout(() => setCopiato(false), 1500); } catch { /* non blocca */ }
  }

  return (
    <div className="docrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <b>{a.azione === 'Messaggio ospite' ? '📨' : '🔔'} {a.ospite}</b>
        <span className="empty">{a.alloggio} · {ggmm(a.checkin)} → {ggmm(a.checkout)}</span>
        <span className={`pill ${aperta && scaduta ? 'pill-Scaduto' : 'pill-Bozza'}`}>
          {aperta ? (scaduta ? 'da fare ora' : `dal ${fmtScadenza(a.scadenza)}`) : a.stato.toLowerCase()}
        </span>
      </div>
      <span className="empty">{a.regola}</span>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: 'var(--bg, transparent)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px' }}>{a.testo}</div>
      <span className="azioni" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {a.linkWhatsapp && aperta && <a className="add" href={a.linkWhatsapp} target="_blank" rel="noopener">💬 Apri WhatsApp</a>}
        {a.azione === 'Messaggio ospite' && !a.linkWhatsapp && aperta && <span className="empty">⚠️ manca il numero di telefono dell&apos;ospite</span>}
        <button className="mini" onClick={copia}>{copiato ? '✓ copiato' : '📋 copia testo'}</button>
        {puoModificare && aperta && <button className="mini" disabled={busy} onClick={() => segna('Fatta')}>✓ Fatto</button>}
        {puoModificare && aperta && <button className="mini" disabled={busy} onClick={() => segna('Saltata')}>Salta</button>}
        {puoModificare && !aperta && <button className="mini" disabled={busy} onClick={() => segna('Da fare')}>↺ Riapri</button>}
      </span>
    </div>
  );
}

function RigaMessaggio({ r, puoModificare, onCambiato }: { r: RigaMessaggioPrenotazione; puoModificare: boolean; onCambiato: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [apri, setApri] = useState(false);
  async function segna(stato: 'Fatta' | 'Saltata') {
    if (!r.attivitaId) return;
    setBusy(true);
    try { await api('segna-attivita', { id: r.attivitaId, dati: { stato } }); await onCambiato(); } finally { setBusy(false); }
  }
  const aperto = r.stato === 'Pronto' || r.stato === 'In programma';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0', borderTop: '1px dashed var(--line)' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span className="chip" style={{ background: COLORE_STATO[r.stato] + '22', color: COLORE_STATO[r.stato] }}>{r.stato}</span>
        <span>{r.regola}</span>
        {r.motivo && <span className="empty">· {r.motivo}</span>}
        {r.scadenza && r.stato === 'In programma' && <span className="empty">· dal {fmtScadenza(r.scadenza)}</span>}
      </div>
      {aperto && r.testo && (
        <span className="azioni" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {r.linkWhatsapp && <a className="add" href={r.linkWhatsapp} target="_blank" rel="noopener">💬 WhatsApp</a>}
          {r.linkEmail && <a className="add" href={r.linkEmail}>✉️ Email</a>}
          {!r.linkWhatsapp && !r.linkEmail && r.azione === 'Messaggio ospite' && <span className="empty">⚠️ manca telefono ed email dell&apos;ospite</span>}
          <button className="mini" onClick={() => setApri(!apri)}>{apri ? 'Nascondi testo' : 'Vedi testo'}</button>
          {puoModificare && r.attivitaId && <button className="mini" disabled={busy} onClick={() => segna('Fatta')}>✓ Inviato</button>}
          {puoModificare && r.attivitaId && <button className="mini" disabled={busy} onClick={() => segna('Saltata')}>Salta</button>}
        </span>
      )}
      {apri && r.testo && <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--ink-muted)' }}>{r.testo}</div>}
    </div>
  );
}

function PerPrenotazione({ elenco, puoModificare, onCambiato }: { elenco: PromemoriaPrenotazione[]; puoModificare: boolean; onCambiato: () => Promise<void> }) {
  return (
    <div className="card">
      <div className="cardhead"><h2>Per prenotazione <small>({elenco.length})</small></h2></div>
      <p className="sub" style={{ marginTop: -4 }}>
        Per ogni prenotazione in arrivo, lo stato dei messaggi previsti dalle regole attive: <b>Pronto</b> da mandare, <b>Inviato</b>, <b>Bloccato</b> (con il motivo),
        <b> Non necessario</b> (con il motivo). Nessun messaggio parte da solo: tu apri WhatsApp o email, controlli e invii; poi tocchi &ldquo;Inviato&rdquo;.
      </p>
      {elenco.map((p) => (
        <div key={p.prenotazioneId} className="docrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <b>{p.ospite}</b>
            <span className="empty">{p.alloggio} · {ggmm(p.checkin)} → {ggmm(p.checkout)} · {p.canale}</span>
          </div>
          {p.righe.map((r) => <RigaMessaggio key={r.regolaId} r={r} puoModificare={puoModificare} onCambiato={onCambiato} />)}
        </div>
      ))}
      {elenco.length === 0 && <p className="empty">Nessuna prenotazione in arrivo con messaggi previsti. Attiva qualche regola qui sotto.</p>}
    </div>
  );
}

export function PromemoriaBox({ promemoria, alloggi, puoModificare, ruoloTitolare, onCambiato }: {
  promemoria: Promemoria; alloggi: Alloggio[]; puoModificare: boolean; ruoloTitolare: boolean; onCambiato: () => Promise<void>;
}) {
  const [modifica, setModifica] = useState<RegolaPromemoria | 'nuova' | null>(null);
  const [mostraChiuse, setMostraChiuse] = useState(false);
  const [err, setErr] = useState('');
  const { aperte, chiuse, regole } = promemoria;
  const [msgModelli, setMsgModelli] = useState('');

  const opzAlloggi = [{ v: 'tutti', t: 'Tutti gli alloggi' }, ...alloggi.map((a) => ({ v: a.id, t: a.nome }))];

  async function attivaDisattiva(r: RegolaPromemoria) {
    setErr('');
    try { await api('aggiorna-regola', { id: r.id, dati: { attiva: !r.attiva } }); await onCambiato(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  async function elimina(r: RegolaPromemoria) {
    if (!confirm(`Eliminare la regola "${r.nome}"? Le attività che ha generato spariscono con lei.`)) return;
    setErr('');
    try { await api('elimina-regola', { id: r.id }); await onCambiato(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  async function installaModelli() {
    setErr(''); setMsgModelli('');
    try {
      const r = await api('installa-modelli-regole', {}) as { create?: string[]; giaPresenti?: string[] };
      setMsgModelli(r?.create?.length ? `✓ Aggiunti ${r.create.length} modelli, tutti DISATTIVATI: attiva quelli che vuoi con il tasto "Attiva".` : 'I modelli ci sono già tutti.');
      await onCambiato();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  const campi = [
    { k: 'nome', label: 'Nome della regola', req: true },
    { k: 'evento', label: 'Quando (evento di riferimento)', tipo: 'select' as const, opzioni: EVENTI },
    { k: 'offsetGiorni', label: 'Giorni rispetto all\'evento (negativo = prima, 0 = lo stesso giorno)', tipo: 'number' as const },
    { k: 'ora', label: 'Ora (HH:MM, ora italiana)', req: true },
    { k: 'azione', label: 'Cosa preparare', tipo: 'select' as const, opzioni: AZIONI },
    { k: 'modello', label: 'Testo — segnaposto: {nome} {cognome} {alloggio} {checkin} {checkout} {notti} {messaggio_guida} {emoji} {link_info} {link_checkin}', tipo: 'textarea' as const, req: true },
    { k: 'alloggioId', label: 'Solo per l\'alloggio', tipo: 'select' as const, opzioni: opzAlloggi },
    { k: 'canale', label: 'Solo per il canale', tipo: 'select' as const, opzioni: CANALI },
    { k: 'minNotti', label: 'Solo da quante notti (facoltativo)', tipo: 'number' as const },
    { k: 'condizione', label: 'Condizione', tipo: 'select' as const, opzioni: CONDIZIONI },
  ];

  function iniziali(r: RegolaPromemoria | 'nuova'): Record<string, unknown> {
    if (r === 'nuova') return { evento: 'Check-in', offsetGiorni: -1, ora: '10:00', azione: 'Messaggio ospite', alloggioId: 'tutti', canale: 'tutti', condizione: 'nessuna' };
    return { ...r, alloggioId: r.alloggioId ?? 'tutti', canale: r.canale ?? 'tutti', minNotti: r.minNotti ?? '', condizione: r.condizione ?? 'nessuna' };
  }

  async function invia(v: Record<string, unknown>) {
    const dati = {
      ...v,
      offsetGiorni: v.offsetGiorni ?? 0,
      alloggioId: v.alloggioId === 'tutti' || !v.alloggioId ? null : v.alloggioId,
      canale: v.canale === 'tutti' || !v.canale ? null : v.canale,
      minNotti: v.minNotti ?? null,
      condizione: v.condizione === 'nessuna' || !v.condizione ? null : v.condizione,
    };
    if (modifica === 'nuova') await api('crea-regola', { dati });
    else if (modifica) await api('aggiorna-regola', { id: modifica.id, dati });
    setModifica(null);
    await onCambiato();
  }

  return (
    <>
      <div className="card">
        <div className="cardhead"><h2>Da fare <small>({aperte.length})</small></h2></div>
        <p className="sub" style={{ marginTop: -4 }}>
          Promemoria e messaggi preparati dalle regole qui sotto. Nessun messaggio parte da solo: tocca &ldquo;Apri WhatsApp&rdquo;, controlla e invia tu.
          Se una prenotazione cambia date, i promemoria si spostano da soli; se la cancelli, spariscono.
        </p>
        {aperte.map((a) => <CardAttivita key={a.id} a={a} puoModificare={puoModificare} onCambiato={onCambiato} />)}
        {aperte.length === 0 && <p className="empty">Niente da fare per ora.</p>}
      </div>

      <PerPrenotazione elenco={promemoria.perPrenotazione ?? []} puoModificare={puoModificare} onCambiato={onCambiato} />

      <div className="card">
        <div className="cardhead">
          <h2>Regole <small>({regole.length})</small></h2>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ruoloTitolare && <button className="mini" onClick={installaModelli}>📑 Aggiungi i modelli pronti</button>}
            {ruoloTitolare && <button className="add" onClick={() => setModifica('nuova')}>＋ Nuova regola</button>}
          </span>
        </div>
        {err && <p className="err">{err}</p>}
        {msgModelli && <p className="empty" style={{ color: '#1FAA6E' }}>{msgModelli}</p>}
        {regole.map((r) => (
          <div key={r.id} className="docrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <b>{r.nome}</b>
              <span className={`pill ${r.attiva ? 'pill-Accettato' : 'pill-Bozza'}`}>{r.attiva ? 'attiva' : 'disattivata'}</span>
            </div>
            <span className="empty">{quando(r)} · {r.azione === 'Messaggio ospite' ? 'messaggio per l\'ospite' : 'promemoria per me'}
              {r.alloggioId ? ` · solo ${alloggi.find((a) => a.id === r.alloggioId)?.nome ?? 'un alloggio'}` : ''}
              {r.canale ? ` · solo ${r.canale}` : ''}{r.minNotti ? ` · da ${r.minNotti} notti` : ''}{r.condizione ? ` · ${ETICHETTA_CONDIZIONE[r.condizione] ?? r.condizione}` : ''}</span>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--ink-muted)' }}>{r.modello}</div>
            {ruoloTitolare && (
              <span className="azioni" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="mini" onClick={() => attivaDisattiva(r)}>{r.attiva ? 'Disattiva' : 'Attiva'}</button>
                <button className="mini" onClick={() => setModifica(r)}>✎ Modifica</button>
                <button className="mini" onClick={() => elimina(r)}>✕</button>
              </span>
            )}
          </div>
        ))}
        {regole.length === 0 && <p className="empty">Nessuna regola ancora.</p>}
      </div>

      <div className="card">
        <div className="cardhead">
          <h2>Già gestite <small>({chiuse.length})</small></h2>
          <button className="mini" onClick={() => setMostraChiuse(!mostraChiuse)}>{mostraChiuse ? 'Nascondi' : 'Mostra'}</button>
        </div>
        {mostraChiuse && chiuse.map((a) => <CardAttivita key={a.id} a={a} puoModificare={puoModificare} onCambiato={onCambiato} />)}
        {mostraChiuse && chiuse.length === 0 && <p className="empty">Ancora nessuna.</p>}
      </div>

      {modifica && (
        <FormModale
          titolo={modifica === 'nuova' ? 'Nuova regola' : `Modifica: ${modifica.nome}`}
          campi={campi}
          iniziali={iniziali(modifica)}
          onInvia={invia}
          onClose={() => setModifica(null)}
        />
      )}
    </>
  );
}
