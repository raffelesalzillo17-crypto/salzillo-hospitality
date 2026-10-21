'use client';

import { useState } from 'react';
import type { DocumentoCaricato, Ospite, Preventivo, Richiesta } from '../tipi';
import { api, dataIt, eur } from '../utilita';

// ── Documenti / Preventivi ─────────────────────────────────────────────────
export function Documenti({ preventivi, documenti, richieste, ospiti, puoModificare, ruoloTitolare, onCambiato, onNuovoPreventivo }: {
  preventivi: Preventivo[]; documenti: DocumentoCaricato[]; richieste: Richiesta[]; ospiti: Ospite[]; puoModificare: boolean; ruoloTitolare: boolean; onCambiato: () => Promise<void>; onNuovoPreventivo: () => void;
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
    // Niente emoji "astrali" (4 byte, es. 📅💶👋) qui: Raffaele ha visto arrivare dei
    // caratteri rotti (�) nel messaggio vero — probabile problema di codifica lungo la strada
    // verso WhatsApp. Il grassetto e la spaziatura bastano a renderlo meno piatto senza
    // rischiare lo stesso problema.
    return [
      `${saluto}${primo ? ' ' + primo : ''}! Sono Raffaele di *Salzillo Hospitality*.`,
      ``,
      `Ecco il tuo preventivo per *${p.alloggio}*:`,
      `${dataIt(p.checkin)} → ${dataIt(p.checkout)} (${notti} nott${notti === 1 ? 'e' : 'i'}, ${p.numeroOspiti} ospiti)`,
      `Totale: *${eur(Number(p.totale))}*${Number(p.sconto) > 0 ? ` (sconto −${eur(Number(p.sconto))})` : ''}`,
      ``,
      `Le date restano riservate per te per le prossime ${p.validoOre} or${p.validoOre === 1 ? 'a' : 'e'}. Cancellazione gratuita fino a 48h prima del check-in.`,
      ``,
      `Tutti i dettagli qui: ${link}`,
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
