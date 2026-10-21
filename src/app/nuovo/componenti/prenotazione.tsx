'use client';

import { useEffect, useState } from 'react';
import type { Alloggio, DatiSch, Ospite, Prenotazione, TabelleAll } from '../tipi';
import { SCH_VUOTA, api, dataIt, eur, neg, normAll, ridimensiona } from '../utilita';

export function DocumentiPrenotazione({ prenotazioneId, puoModificare }: { prenotazioneId: string; puoModificare: boolean }) {
  type Doc = { id: string; nome: string; driveUrl: string | null; mime: string | null; caricatoIl: string };
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [sch, setSch] = useState<DatiSch | null>(null);
  const [tab, setTab] = useState<TabelleAll | null>(null);

  async function carica() {
    try {
      const r = await fetch(`/api/nuovo/documenti-prenotazione?prenotazione=${prenotazioneId}`);
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Errore');
      setDocs(d.documenti);
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); setDocs([]); }
  }
  useEffect(() => {
    fetch(`/api/nuovo/documenti-prenotazione?prenotazione=${prenotazioneId}`)
      .then((x) => x.json())
      .then((d) => { if (d.ok) setDocs(d.documenti); else { setErr(d.error || 'Errore'); setDocs([]); } })
      .catch((e) => { setErr(String(e instanceof Error ? e.message : e)); setDocs([]); });
  }, [prenotazioneId]);

  async function invia(lista: FileList | null) {
    if (!lista || !lista.length) return;
    setBusy(true); setErr(''); setOk('');
    try {
      const fd = new FormData();
      fd.append('prenotazione', prenotazioneId);
      for (const f of Array.from(lista)) fd.append('file', await ridimensiona(f));
      const r = await fetch('/api/nuovo/documenti-prenotazione', { method: 'POST', body: fd });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Errore');
      await carica();
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  }

  async function elimina(id: string) {
    if (!confirm('Togliere questo documento? Il file va nel cestino di Drive.')) return;
    setBusy(true); setErr(''); setOk('');
    try {
      const r = await fetch(`/api/nuovo/documenti-prenotazione?id=${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Errore');
      await carica();
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  }

  async function leggi(docId: string) {
    setBusy(true); setErr(''); setOk('');
    try {
      const r = await fetch('/api/nuovo/schedina-da-documento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentoId: docId }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Errore');
      if (!tab) setTab(await fetch('/checkin/tabelle.json').then((x) => x.json()));
      setSch({ ...SCH_VUOTA, ...d.dati, tipoAlloggiatoCodice: '16', comuneNascitaCodice: '' });
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  }

  async function creaSchedina() {
    if (!sch) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/nuovo/schedina', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenotazioneId, ospite: sch }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Errore');
      setOk(`✅ Schedina creata per ${sch.nome} ${sch.cognome}: la trovi tra i documenti check-in ricevuti e in Alloggiati Web.`);
      setSch(null);
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  }

  const set = (k: keyof DatiSch, v: string) => setSch((s) => (s ? { ...s, [k]: v } : s));
  const nataInItalia = !!sch && normAll(sch.statoNascita) === 'ITALIA';
  const candidati = sch && tab && nataInItalia ? tab.comuni.filter((c) => normAll(c.nome) === normAll(sch.luogoNascita)) : [];
  const campo = (label: string, k: keyof DatiSch, extra: { list?: string; placeholder?: string } = {}) => (
    <label style={{ display: 'block', margin: '5px 0' }}>
      <span className="sub">{label}</span>
      <input value={sch ? sch[k] : ''} onChange={(e) => set(k, e.target.value)} list={extra.list} placeholder={extra.placeholder}
        style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} />
    </label>
  );

  return (
    <div style={{ marginTop: 14 }}>
      <b>📎 Documenti degli ospiti</b>
      {docs === null && <p className="sub">Carico…</p>}
      {docs && docs.length === 0 && <p className="sub">Nessun documento ancora.</p>}
      {docs && docs.map((d) => (
        <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0', flexWrap: 'wrap' }}>
          {d.driveUrl
            ? <a href={d.driveUrl} target="_blank" rel="noopener">{d.nome}</a>
            : <span>{d.nome}</span>}
          <span className="sub" style={{ marginLeft: 'auto' }}>{new Date(d.caricatoIl).toLocaleDateString('it-IT')}</span>
          {puoModificare && d.mime?.startsWith('image/') && (
            <button className="mini" disabled={busy} onClick={() => leggi(d.id)} title="Leggi il documento e precompila la schedina Alloggiati">🔍 Leggi</button>
          )}
          {puoModificare && <button className="mini" disabled={busy} onClick={() => elimina(d.id)} title="Togli il documento">✕</button>}
        </div>
      ))}
      {puoModificare && (
        <label className="sync" style={{ display: 'inline-block', marginTop: 6, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Un attimo…' : '＋ Aggiungi documenti (foto o PDF)'}
          <input type="file" accept="image/*,application/pdf" multiple disabled={busy} style={{ display: 'none' }}
            onChange={(e) => { invia(e.target.files); e.target.value = ''; }} />
        </label>
      )}

      {sch && tab && (
        <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--line)', borderRadius: 8 }}>
          <b>Schedina Alloggiati — controlla i dati letti</b>
          <p className="sub">Compilati dalla lettura automatica: correggi se serve prima di creare la schedina.</p>
          {campo('Cognome', 'cognome')}
          {campo('Nome', 'nome')}
          <label style={{ display: 'block', margin: '5px 0' }}>
            <span className="sub">Sesso</span>
            <select value={sch.sesso} onChange={(e) => set('sesso', e.target.value)} style={{ display: 'block' }}>
              <option value="">—</option><option value="M">M</option><option value="F">F</option>
            </select>
          </label>
          {campo('Data di nascita', 'dataNascita', { placeholder: 'GG/MM/AAAA' })}
          {campo('Stato di nascita', 'statoNascita', { list: 'dl-stati-sch' })}
          {campo('Comune / città di nascita', 'luogoNascita')}
          {nataInItalia && candidati.length > 1 && (
            <label style={{ display: 'block', margin: '5px 0' }}>
              <span className="sub">Più comuni con questo nome: scegli la provincia</span>
              <select value={sch.comuneNascitaCodice} onChange={(e) => set('comuneNascitaCodice', e.target.value)} style={{ display: 'block' }}>
                <option value="">— scegli —</option>
                {candidati.map((c) => <option key={c.codice} value={c.codice}>{c.nome} ({c.provincia})</option>)}
              </select>
            </label>
          )}
          {nataInItalia && candidati.length === 0 && sch.luogoNascita && <p className="sub" style={{ color: '#d33' }}>Comune non trovato nelle tabelle ufficiali: controlla il nome.</p>}
          {campo('Cittadinanza', 'cittadinanza', { list: 'dl-stati-sch' })}
          <label style={{ display: 'block', margin: '5px 0' }}>
            <span className="sub">Tipo di documento</span>
            <select value={sch.tipoDocumento} onChange={(e) => set('tipoDocumento', e.target.value)} style={{ display: 'block' }}>
              <option value="">—</option><option value="Carta d'identità">Carta d&apos;identità</option>
              <option value="Passaporto">Passaporto</option><option value="Patente">Patente</option>
            </select>
          </label>
          {campo('Numero documento', 'numeroDocumento')}
          {campo('Luogo di rilascio (facoltativo)', 'luogoRilascioDocumento')}
          <label style={{ display: 'block', margin: '5px 0' }}>
            <span className="sub">Tipo di ospite</span>
            <select value={sch.tipoAlloggiatoCodice} onChange={(e) => set('tipoAlloggiatoCodice', e.target.value)} style={{ display: 'block' }}>
              <option value="16">Ospite singolo</option><option value="17">Capofamiglia</option><option value="18">Capogruppo</option>
              <option value="19">Familiare</option><option value="20">Membro gruppo</option>
            </select>
          </label>
          <datalist id="dl-stati-sch">{tab.stati.map((s) => <option key={s.codice} value={s.nome} />)}</datalist>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="sync" disabled={busy} onClick={creaSchedina}>{busy ? 'Un attimo…' : 'Crea schedina'}</button>
            <button className="mini" disabled={busy} onClick={() => setSch(null)}>Annulla</button>
          </div>
        </div>
      )}
      {ok && <p style={{ color: '#1FAA6E' }}>{ok}</p>}
      {err && <p style={{ color: '#d33' }}>{err}</p>}
    </div>
  );
}

export function DettaglioPrenotazione({ p, alloggi, puoModificare, apriPagamentoSubito, onClose, onSalvato }: {
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
            <DocumentiPrenotazione prenotazioneId={p.id} puoModificare={puoModificare} />

            {p.pagamenti.length > 0 && (
              <table className="tbl" style={{ marginTop: 10 }}><tbody>
                <tr><td colSpan={2}><b style={{ fontSize: 13 }}>Pagamenti registrati</b></td></tr>
                {p.pagamenti.map((pg) => (
                  <tr key={pg.id}><td>{pg.tipo} · {dataIt(pg.data)}{pg.metodo ? ` · ${pg.metodo}` : ''}</td><td className="num">{eur(pg.importo)}</td></tr>
                ))}
                <tr className="tot"><td>Totale incassato</td><td className="num strong">{eur(p.pagamenti.reduce((s, pg) => s + pg.importo, 0))}</td></tr>
              </tbody></table>
            )}

            {p.schedine.length > 0 && (
              <table className="tbl" style={{ marginTop: 10 }}><tbody>
                <tr><td colSpan={2}><b style={{ fontSize: 13 }}>Documenti check-in ricevuti ({p.schedine.length})</b></td></tr>
                {p.schedine.map((s) => (
                  <tr key={s.id}>
                    <td>{s.cognome} {s.nome} <small className="sub">({s.rapporto || '—'})</small></td>
                    <td className="num"><small>{s.tipoDocumento || '—'} {s.numeroDocumento}</small></td>
                  </tr>
                ))}
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
                  const conTotale = p.canale === 'Diretto' || p.canale === 'No Tax';
                  const msg = [
                    `${saluto} ${primo}, sono Raffaele di Salzillo Hospitality.`,
                    `Ecco la conferma della tua prenotazione per ${p.alloggio}:`,
                    `Check-in ${dataIt(p.checkin)} · Check-out ${dataIt(p.checkout)}`,
                    ...(conTotale ? [`Totale concordato: ${eur(p.lordo)}`] : []),
                    `Qui il PDF con tutti i dettagli: ${pdfUrl}`,
                    `Per qualsiasi dubbio scrivimi pure qui.`,
                  ].join('\n');
                  return <a className="sync" href={`https://wa.me/${num}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>💬 Manda conferma su WhatsApp</a>;
                })()}
                
                {/* Solo Il Tulipano (unica struttura con link recensioni Google confermato, vedi
                    reviewMessage in src/lib/telegramDigest.ts) e solo da check-out avvenuto —
                    prima non ha senso chiedere una recensione. Riportata in dashboard il
                    22/09/2026 su richiesta di Raffaele: prima esisteva solo come promemoria
                    Telegram automatico (digest serale), non come azione manuale da qui. */}
                {p.telefono && p.alloggio === 'Il Tulipano' && p.checkout <= new Date().toISOString().slice(0, 10) && (() => {
                  const t = p.telefono.replace(/[^\d]/g, '');
                  const num = t.length === 10 ? '39' + t : t;
                  const link = 'https://g.page/r/CVxuMMgN8XDNEAE/review';
                  const msg = `Grazie per aver soggiornato al B&B Il Tulipano! 🌷\n\nSperiamo che tutto sia andato per il meglio e che vi siate trovati bene con noi.\n\nSe vi va, una recensione su Google ci aiuterebbe moltissimo — bastano due minuti:\n⭐ ${link}\n\nGrazie di cuore, per noi è un piccolo gesto che conta davvero.\n\nA presto! 🌷\nSalzillo Hospitality — B&B Il Tulipano`;
                  return <a className="sync" href={`https://wa.me/${num}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>⭐ Chiedi recensione</a>;
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

export function FormPrenotazione({ alloggi, ospiti, onClose, onSalvato }: {
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
