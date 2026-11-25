'use client';

import { useMemo, useState } from 'react';
import type { Dati, Scadenza } from '../tipi';
import { api, dataIt, preparaFile, rispostaCaricamento } from '../utilita';
import type { Modale } from './ospiti';

// ── Scadenze (punto 13 delle richieste, 23/11/2026) ───────────────────────────────────────────
// Una scadenza per ente con ricorrenza automatica (la data successiva si calcola dalla data PREVISTA), stati
// Aperta / Fatta / Non più applicabile, storico con ricevuta, archivio e ricerca dei doppioni con anteprima.
// Le voci archiviate non compaiono in Dashboard.

type Voce = { id: string; titolo: string; ente: string | null; dataScadenza: string; ricorrenza: string; origine: string; ultimoCompletamento: string | null; note: string | null };
type Gruppo = { principaleSuggerito: string; voci: Voce[] };

const ENTI = ['', 'Agenzia delle Entrate', 'Comune', 'Ministero del Turismo', 'Regione Campania', 'Questura (Alloggiati Web)', 'SIAE', 'Altro'];

export function SezioneScadenze({ dati, sess, oggi, setModale, onCambiato }: {
  dati: Dati; sess: { ruolo: string; puoModificare: boolean }; oggi: string; setModale: (m: Modale) => void; onCambiato: () => Promise<void>;
}) {
  const titolare = sess.ruolo === 'Titolare';
  const [vista, setVista] = useState<'aperte' | 'archivio'>('aperte');
  const [fare, setFare] = useState<string | null>(null); // scadenza per cui si sta registrando "fatta"
  const [fattaIl, setFattaIl] = useState(oggi);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [esito, setEsito] = useState('');
  const [dup, setDup] = useState<Gruppo[] | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [principale, setPrincipale] = useState<Record<number, string>>({});
  const fra30 = new Date(Date.parse(oggi) + 30 * 864e5).toISOString().slice(0, 10);

  const tutte = dati.scadenze;
  const aperte = tutte.filter((s) => (s.stato ?? 'Aperta') === 'Aperta');
  const archivio = tutte.filter((s) => (s.stato ?? 'Aperta') !== 'Aperta').sort((a, b) => (b.chiusaIl ?? '').localeCompare(a.chiusaIl ?? ''));
  const mostrate = vista === 'aperte' ? aperte : archivio;
  const gruppi = useMemo(() => {
    const m = new Map<string, Scadenza[]>();
    for (const s of [...mostrate].sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza))) { const k = s.ente || (s.immobile ? s.immobile : 'Generali'); m.set(k, [...(m.get(k) ?? []), s]); }
    return m;
  }, [mostrate]);

  async function esegui(chiave: string, azione: string, id: string | undefined, dd?: Record<string, unknown>, conferma?: string): Promise<unknown> {
    if (conferma && !confirm(conferma)) return undefined;
    setBusy(chiave); setErr(''); setEsito('');
    try { const r = await api(azione, { id, dati: dd }); await onCambiato(); return r; }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); return undefined; }
    finally { setBusy(''); }
  }

  async function segnaFatta(s: Scadenza) {
    setBusy('f' + s.id); setErr(''); setEsito('');
    try {
      const r = await api('completa-scadenza', { id: s.id, dati: { fattaIl } }) as { prossima: string | null };
      if (file) {
        const f = new FormData(); f.append('scadenza', s.id); f.append('file', await preparaFile(file));
        const d = await rispostaCaricamento(await fetch('/api/nuovo/scadenze/ricevuta', { method: 'POST', body: f }));
        if (!d.ok) setErr(`Segnata come fatta, ma la ricevuta no: ${d.error || 'errore'}`);
      }
      setEsito(r.prossima ? `Fatto. Prossima scadenza: ${dataIt(r.prossima)}.` : 'Fatto: la scadenza è archiviata.');
      setFare(null); setFile(null); await onCambiato();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  async function allegaDopo(s: Scadenza, f: File | null) {
    if (!f) return;
    setBusy('r' + s.id); setErr('');
    try {
      const fd = new FormData(); fd.append('scadenza', s.id); fd.append('file', await preparaFile(f));
      const d = await rispostaCaricamento(await fetch('/api/nuovo/scadenze/ricevuta', { method: 'POST', body: fd }));
      if (!d.ok) throw new Error(d.error || 'Ricevuta non salvata');
      await onCambiato();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  async function cercaDoppioni() {
    setBusy('dup'); setErr(''); setEsito('');
    try {
      const g = await api('cerca-duplicati-scadenze') as Gruppo[];
      setDup(g); const p: Record<number, string> = {}; g.forEach((x, i) => { p[i] = x.principaleSuggerito; }); setPrincipale(p);
      if (g.length === 0) setEsito('Nessun doppione trovato.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  async function unisci(i: number, g: Gruppo) {
    const princ = g.voci.find((v) => v.id === principale[i]) ?? g.voci[0];
    const altre = g.voci.filter((v) => v.id !== princ.id);
    if (!confirm(`Unire in una sola "${princ.titolo}"?\n\nSi tiene quella con data ${dataIt(princ.dataScadenza)}${princ.ente ? ` (${princ.ente})` : ''}; ${altre.length === 1 ? 'l\'altra va' : `le altre ${altre.length} vanno`} nel cestino per 30 giorni.`)) return;
    setBusy('u' + i); setErr('');
    try { await api('unisci-scadenze', { id: princ.id, dati: { daRimuovere: altre.map((v) => v.id) } }); await onCambiato(); await cercaDoppioni(); setEsito('Unite.'); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(''); }
  }

  return (
    <div className="card">
      <div className="cardhead">
        <h2>Scadenze <small>({aperte.length} aperte{archivio.length ? ` · ${archivio.length} archiviate` : ''})</small></h2>
        {sess.puoModificare && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tutte.length === 0 && <button className="add" onClick={async () => { if (confirm('Aggiungo le scadenze fiscali/amministrative tipiche di un B&B in Campania?')) { await api('seed-scadenze'); await onCambiato(); } }}>✨ Scadenze tipiche</button>}
          {titolare && <button className="add" disabled={busy === 'dup'} onClick={cercaDoppioni}>🔍 Doppioni</button>}
          <button className="add" onClick={() => setModale({ titolo: 'Nuova scadenza', azione: 'crea-scadenza', campi: [
            { k: 'titolo', label: 'Titolo', req: true },
            { k: 'ente', label: 'Ente / regione', tipo: 'select', opzioni: ENTI.map((v) => ({ v, t: v || '— nessuno —' })) },
            { k: 'dataScadenza', label: 'Data', tipo: 'date', req: true },
            { k: 'ricorrenza', label: 'Ricorrenza (si rinnova da sola quando la fai)', tipo: 'select', opzioni: ['Una tantum', 'Mensile', 'Semestrale', 'Annuale'].map((r) => ({ v: r, t: r })) },
            { k: 'immobileId', label: 'Immobile (vuoto = generale)', tipo: 'select', opzioni: [{ v: '', t: '— generale —' }, ...dati.anagrafica.flatMap((p) => p.immobili.map((i) => ({ v: i.id, t: i.nome })))] },
            { k: 'note', label: 'Note' },
          ] })}>＋ Scadenza</button>
        </div>}
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '4px 0 8px' }}>
        <button className={vista === 'aperte' ? 'add' : 'mini'} onClick={() => setVista('aperte')}>Aperte</button>
        <button className={vista === 'archivio' ? 'add' : 'mini'} onClick={() => setVista('archivio')}>Archivio (fatte e non più applicabili)</button>
      </div>
      {err && <p className="err">{err}</p>}
      {esito && <p className="empty" style={{ color: '#1FAA6E' }}>{esito}</p>}

      {dup && dup.length > 0 && (
        <div className="docgroup" style={{ marginBottom: 12 }}>
          <h3><span>Possibili doppioni ({dup.length})</span><button className="mini" onClick={() => setDup(null)}>chiudi</button></h3>
          <p className="sub">Sono la stessa scadenza scritta due volte (di solito una creata a mano e una importata dal vecchio foglio). Scegli quale tenere: l&apos;altra va nel cestino per 30 giorni. Niente si unisce da solo.</p>
          {dup.map((g, i) => (
            <div key={i} className="docrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              {g.voci.map((v) => (
                <label key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="radio" name={`dupsc-${i}`} checked={principale[i] === v.id} onChange={() => setPrincipale({ ...principale, [i]: v.id })} style={{ width: 'auto' }} />
                  <b>{v.titolo}</b>
                  <small className="sub">{v.ente ?? 'senza ente'} · {dataIt(v.dataScadenza)} · {v.ricorrenza.toLowerCase()} · creata {v.origine === 'Database' ? 'qui' : 'dal vecchio foglio'}{v.ultimoCompletamento ? ` · ultima volta ${dataIt(v.ultimoCompletamento)}` : ''}</small>
                  {principale[i] === v.id ? <span className="pill pill-Accettato">si tiene</span> : <span className="pill pill-Scaduto">va nel cestino</span>}
                </label>
              ))}
              <div><button className="mini coral" disabled={busy === 'u' + i} onClick={() => unisci(i, g)}>Unisci</button></div>
            </div>
          ))}
        </div>
      )}

      {mostrate.length === 0 && <p className="empty">{vista === 'aperte' ? 'Nessuna scadenza aperta. Usa "Scadenze tipiche" per partire.' : 'Nessuna scadenza archiviata.'}</p>}
      {[...gruppi.keys()].sort().map((k) => (
        <div key={k} className="docgroup">
          <h3><span>🏛️ {k}</span><span className="empty">{gruppi.get(k)!.length}</span></h3>
          {gruppi.get(k)!.map((s) => {
            const urg = s.dataScadenza < oggi ? 'scaduta' : s.dataScadenza <= fra30 ? 'vicina' : '';
            const haAltro = !!(s.ultimaRicevuta || (sess.puoModificare && (((s.volteFatta ?? 0) > 0) || vista === 'aperte')));
            return (
              <div key={s.id} className="docrow" style={{ flexWrap: 'wrap', gap: 8 }}>
                {vista === 'aperte'
                  ? <span className={`pill ${urg === 'scaduta' ? 'pill-Scaduto' : urg === 'vicina' ? 'pill-Inviato' : 'pill-Bozza'}`}>{dataIt(s.dataScadenza)}{urg === 'scaduta' ? ' · scaduta' : ''}</span>
                  : <span className={`pill ${s.stato === 'Fatta' ? 'pill-Accettato' : 'pill-Bozza'}`}>{s.stato}{s.chiusaIl ? ` · ${dataIt(s.chiusaIl)}` : ''}</span>}
                <b>{s.titolo}</b>
                <span className="empty">{s.ricorrenza !== 'Una tantum' ? `si ripete: ${s.ricorrenza.toLowerCase()}` : ''} {s.immobile ? `· ${s.immobile}` : ''}{s.ultimoCompletamento ? ` · ultima volta ${dataIt(s.ultimoCompletamento)}` : ''}</span>
                {s.motivoChiusura && <span className="empty" style={{ flexBasis: '100%' }}>Motivo: {s.motivoChiusura}</span>}
                {s.note && <span className="empty" style={{ flexBasis: '100%' }}>{s.note}</span>}
                <span className="azioni scad-azioni">
                  {sess.puoModificare && vista === 'aperte' && (
                    <button type="button" className="add" onClick={() => { setMenu(null); setFare(fare === s.id ? null : s.id); setFattaIl(oggi); setFile(null); }}>Segna fatta</button>
                  )}
                  {sess.puoModificare && vista === 'archivio' && <button type="button" className="mini" disabled={busy === 'o' + s.id} onClick={() => esegui('o' + s.id, 'riapri-scadenza', s.id, undefined, `Riaprire "${s.titolo}"? Torna tra le scadenze aperte.`)}>Riapri</button>}
                  {haAltro && <button type="button" className="mini" aria-label="Altre azioni" aria-expanded={menu === s.id} onClick={() => setMenu(menu === s.id ? null : s.id)}>⋯</button>}
                </span>
                {menu === s.id && (
                  <div className="menu-altro" role="menu">
                    {s.ultimaRicevuta && <a className="mini" href={`/api/nuovo/scadenze/ricevuta?scadenza=${s.id}`} target="_blank" rel="noopener">Apri ricevuta</a>}
                    {sess.puoModificare && (s.volteFatta ?? 0) > 0 && (
                      <label className="mini" style={{ cursor: 'pointer' }}>{busy === 'r' + s.id ? 'Carico…' : 'Allega ricevuta'}
                        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => { allegaDopo(s, e.target.files?.[0] ?? null); e.target.value = ''; setMenu(null); }} />
                      </label>
                    )}
                    {sess.puoModificare && vista === 'aperte' && (
                      <button type="button" className="voce-pericolo" disabled={busy === 'n' + s.id} onClick={async () => {
                        setMenu(null);
                        const motivo = prompt(`Perché "${s.titolo}" non è più applicabile? (resta nell'archivio, si può riaprire)`);
                        if (motivo) await esegui('n' + s.id, 'non-applicabile-scadenza', s.id, { motivo });
                      }}>Non più applicabile</button>
                    )}
                  </div>
                )}
                {fare === s.id && (
                  <div style={{ flexBasis: '100%', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg)', padding: 8, borderRadius: 8 }}>
                    <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><small>fatta il</small><input type="date" value={fattaIl} max={oggi} onChange={(e) => setFattaIl(e.target.value)} /></label>
                    <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><small>ricevuta (facoltativa)</small><input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
                    <button className="mini coral" disabled={busy === 'f' + s.id || !fattaIl} onClick={() => segnaFatta(s)}>{busy === 'f' + s.id ? '…' : 'Conferma'}</button>
                    <small className="sub">{s.ricorrenza !== 'Una tantum' ? 'Si riapre da sola alla data successiva.' : 'Verrà archiviata come "Fatta".'}</small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
