'use client';

import { useMemo, useState } from 'react';
import type { Dati, Spesa } from '../tipi';
import { api, dataIt, eur } from '../utilita';
import { interpretaEstratto, leggiCsv, proponiMappa, type Mappa, type RigaEstratto } from '../../../lib/estrattoConto';

// ── Scheda Spese (punto 12 delle richieste, 23/11/2026) ──────────────────────────────────────
// Inserimento rapido con foto/PDF della ricevuta, import da estratto conto CSV con abbinamento guidato,
// spese ricorrenti ed export per il commercialista. Niente si importa o si cancella senza conferma.

type Sess = { ruolo: string; puoModificare: boolean };
const METODI = ['Bonifico', 'Contanti', 'Carta', 'Piattaforma'];
const FREQ = ['Mensile', 'Trimestrale', 'Semestrale', 'Annuale'];

type Dest = string; // '' = generale · 'i:<id>' = immobile · 'a:<id>' = alloggio
const destDa = (d: Dest) => (d.startsWith('a:') ? { alloggioId: d.slice(2) } : d.startsWith('i:') ? { immobileId: d.slice(2) } : {});

function SelectDestinazione({ dati, valore, onChange }: { dati: Dati; valore: Dest; onChange: (v: Dest) => void }) {
  return (
    <select value={valore} onChange={(e) => onChange(e.target.value)}>
      <option value="">— generale —</option>
      {dati.anagrafica.flatMap((p) => p.immobili.map((im) => (
        <optgroup key={im.id} label={im.nome}>
          <option value={`i:${im.id}`}>{im.nome} (tutto l&apos;immobile)</option>
          {im.alloggi.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.nome}</option>)}
        </optgroup>
      )))}
    </select>
  );
}

export function SezioneSpese({ dati, sess, oggi, onCambiato }: { dati: Dati; sess: Sess; oggi: string; onCambiato: () => Promise<void> }) {
  const titolare = sess.ruolo === 'Titolare';
  const [pannello, setPannello] = useState<'' | 'nuova' | 'import' | 'ricorrenti' | 'export'>('');
  const [anno, setAnno] = useState(String(new Date(oggi).getFullYear()));
  const [fCat, setFCat] = useState('');
  const [fDest, setFDest] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const anni = useMemo(() => [...new Set([new Date(oggi).getFullYear(), ...dati.spese.map((s) => Number(s.data.slice(0, 4)))])].sort((a, b) => b - a), [dati.spese, oggi]);
  const lista = dati.spese.filter((s) => (!anno || s.data.startsWith(anno)) && (!fCat || s.categoria === fCat)
    && (!fDest || (fDest === 'generale' ? !s.immobile : s.immobile === fDest || s.alloggio === fDest)));
  const totale = lista.reduce((n, s) => n + Number(s.importo), 0);

  async function elimina(s: Spesa) {
    if (!confirm(`Eliminare la spesa "${s.descrizione}" del ${dataIt(s.data)} (${eur(Number(s.importo))})? Resta 30 giorni nel cestino.`)) return;
    setBusy('e' + s.id); setErr('');
    try { await api('elimina-spesa', { id: s.id }); await onCambiato(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  async function allega(s: Spesa, file: File | null) {
    if (!file) return;
    setBusy('r' + s.id); setErr('');
    try { await inviaRicevuta(s.id, file); await onCambiato(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  return (
    <div className="card">
      <div className="cardhead">
        <h2>Spese <small>({lista.length}{anno ? ` nel ${anno}` : ''} · {eur(totale)})</small></h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sess.puoModificare && <button className="add" onClick={() => setPannello(pannello === 'nuova' ? '' : 'nuova')}>＋ Spesa</button>}
          {titolare && <button className="add" onClick={() => setPannello(pannello === 'import' ? '' : 'import')}>📥 Estratto conto</button>}
          {titolare && <button className="add" onClick={() => setPannello(pannello === 'ricorrenti' ? '' : 'ricorrenti')}>🔁 Ricorrenti ({(dati.speseRicorrenti ?? []).filter((r) => r.attiva).length})</button>}
          {titolare && <button className="add" onClick={() => setPannello(pannello === 'export' ? '' : 'export')}>⬇️ Per il commercialista</button>}
        </div>
      </div>

      {pannello === 'nuova' && <NuovaSpesa dati={dati} oggi={oggi} onFatto={async () => { setPannello(''); await onCambiato(); }} />}
      {pannello === 'import' && titolare && <ImportEstratto dati={dati} onFatto={async () => { await onCambiato(); }} />}
      {pannello === 'ricorrenti' && titolare && <Ricorrenti dati={dati} oggi={oggi} onCambiato={onCambiato} />}
      {pannello === 'export' && titolare && <ExportCommercialista dati={dati} anni={anni} annoIniziale={anno || String(new Date(oggi).getFullYear())} />}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
        <select value={anno} onChange={(e) => setAnno(e.target.value)} aria-label="Anno"><option value="">Tutti gli anni</option>{anni.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} aria-label="Categoria"><option value="">Categoria: tutte</option>{(dati.categorieSpesa ?? []).map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select>
        <select value={fDest} onChange={(e) => setFDest(e.target.value)} aria-label="Immobile o alloggio">
          <option value="">Immobile/alloggio: tutti</option><option value="generale">Solo generali</option>
          {dati.anagrafica.flatMap((p) => p.immobili.flatMap((im) => [<option key={im.id} value={im.nome}>{im.nome}</option>, ...im.alloggi.map((a) => <option key={a.id} value={a.nome}>— {a.nome}</option>)]))}
        </select>
      </div>
      {err && <p className="err">{err}</p>}

      <div className="tablescroll">
        <table className="tbl full" style={{ minWidth: 640 }}>
          <thead><tr><th>Data</th><th>Categoria</th><th>Descrizione</th><th>Dove</th><th>Metodo</th><th className="num">Importo</th><th>Ricevuta</th>{titolare && <th></th>}</tr></thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id}>
                <td>{dataIt(s.data)}</td><td>{s.categoria}</td>
                <td>{s.descrizione}{s.ricorrente && <small className="sub"> 🔁</small>}</td>
                <td><small>{s.alloggio ?? s.immobile ?? 'generale'}</small></td>
                <td><small>{s.metodo ?? '—'}</small></td>
                <td className="num">{eur(Number(s.importo))}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {s.haRicevuta && <a className="mini" style={{ textDecoration: 'none' }} href={`/api/nuovo/spese/ricevuta?spesa=${s.id}`} target="_blank" rel="noopener">📎 apri</a>}
                  {sess.puoModificare && (
                    <label className="mini" style={{ cursor: 'pointer' }}>
                      {busy === 'r' + s.id ? '…' : s.haRicevuta ? '↻' : '＋ foto/PDF'}
                      <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => { allega(s, e.target.files?.[0] ?? null); e.target.value = ''; }} />
                    </label>
                  )}
                </td>
                {titolare && <td><button className="mini" disabled={busy === 'e' + s.id} title="Elimina (cestino 30 giorni)" onClick={() => elimina(s)}>🗑</button></td>}
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={titolare ? 8 : 7} className="empty">Nessuna spesa {anno ? `nel ${anno}` : ''}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function inviaRicevuta(spesaId: string, file: File) {
  const f = new FormData(); f.append('spesa', spesaId); f.append('file', file);
  const r = await (await fetch('/api/nuovo/spese/ricevuta', { method: 'POST', body: f })).json();
  if (!r.ok) throw new Error(r.error || 'Ricevuta non salvata');
}

// ── Inserimento rapido ─────────────────────────────────────────────────────────────────────
function NuovaSpesa({ dati, oggi, onFatto }: { dati: Dati; oggi: string; onFatto: () => Promise<void> }) {
  const cat = dati.categorieSpesa ?? [];
  const [v, setV] = useState({ data: oggi, categoriaId: cat[0]?.id ?? '', descrizione: '', importo: '', dest: '' as Dest, metodo: 'Carta', rimborso: false, note: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const manca = !v.data || !v.categoriaId || !v.descrizione.trim() || !(Number(v.importo.replace(',', '.')) > 0);

  async function salva() {
    setBusy(true); setErr('');
    try {
      const r = await api('crea-spesa', { dati: { data: v.data, categoriaId: v.categoriaId, descrizione: v.descrizione.trim(), importo: Number(v.importo.replace(',', '.')), metodoPagamento: v.metodo, daRimborsareProprietario: v.rimborso, note: v.note || undefined, ...destDa(v.dest) } }) as { id: string };
      if (file) {
        try { await inviaRicevuta(r.id, file); }
        catch (e) { setErr(`Spesa salvata, ma la ricevuta no: ${e instanceof Error ? e.message : String(e)} Puoi riprovare dalla lista con "＋ foto/PDF".`); await onFatto(); return; }
      }
      await onFatto();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }

  return (
    <div className="docgroup" style={{ marginBottom: 12 }}>
      <h3><span>Nuova spesa</span></h3>
      <div className="form">
        <label>Data<input type="date" value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} /></label>
        <label>Categoria<select value={v.categoriaId} onChange={(e) => setV({ ...v, categoriaId: e.target.value })}>{cat.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label>Descrizione<input value={v.descrizione} onChange={(e) => setV({ ...v, descrizione: e.target.value })} placeholder="es. Bolletta luce ottobre" /></label>
        <label>Importo €<input inputMode="decimal" value={v.importo} onChange={(e) => setV({ ...v, importo: e.target.value })} placeholder="0,00" /></label>
        <label>Immobile / alloggio<SelectDestinazione dati={dati} valore={v.dest} onChange={(d) => setV({ ...v, dest: d })} /></label>
        <label>Metodo di pagamento<select value={v.metodo} onChange={(e) => setV({ ...v, metodo: e.target.value })}>{METODI.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>Foto o PDF della ricevuta<input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <label style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={v.rimborso} onChange={(e) => setV({ ...v, rimborso: e.target.checked })} style={{ width: 'auto' }} />Da rimborsare al proprietario</label>
        <label>Note<input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></label>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="modalactions"><button className="add" disabled={busy || manca} onClick={salva}>{busy ? 'Salvo…' : 'Salva spesa'}</button></div>
    </div>
  );
}

// ── Import da estratto conto ───────────────────────────────────────────────────────────────
type RigaAnt = RigaEstratto & { categoriaId: string | null; motivoCategoria: string; doppia: boolean };
type RigaScelta = RigaAnt & { includi: boolean; cat: string; dest: Dest; metodo: string };

function leggiTestoFile(buf: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } // gli estratti delle banche sono spesso in Windows-1252
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

function ImportEstratto({ dati, onFatto }: { dati: Dati; onFatto: () => Promise<void> }) {
  const [righeCsv, setRigheCsv] = useState<string[][] | null>(null);
  const [mappa, setMappa] = useState<Mappa | null>(null);
  const [scelte, setScelte] = useState<RigaScelta[] | null>(null);
  const [infoImport, setInfoImport] = useState('');
  const [esito, setEsito] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const categorie = dati.categorieSpesa ?? [];

  async function scegliFile(file: File | null) {
    setErr(''); setScelte(null); setEsito('');
    if (!file) return;
    const r = leggiCsv(leggiTestoFile(await file.arrayBuffer()));
    if (r.length < 2) { setErr('Il file non sembra un CSV con delle righe.'); return; }
    setRigheCsv(r); setMappa(proponiMappa(r));
  }

  async function anteprima() {
    if (!righeCsv || !mappa) return;
    setBusy(true); setErr('');
    try {
      const e = interpretaEstratto(righeCsv, mappa);
      if (e.uscite.length === 0) { setErr(`Nessuna uscita trovata (${e.entrate} entrate ignorate, ${e.ignorate.length} righe scartate). Controlla le colonne scelte.`); setBusy(false); return; }
      const r = await api('anteprima-estratto', { dati: { righe: e.uscite } }) as { righe: RigaAnt[] };
      setScelte(r.righe.map((x) => ({ ...x, includi: !x.doppia, cat: x.categoriaId ?? '', dest: '', metodo: 'Bonifico' })));
      setInfoImport(`${e.uscite.length} uscite · ${e.entrate} entrate ignorate · ${e.ignorate.length} righe scartate${e.ignorate.length ? ` (righe ${e.ignorate.slice(0, 8).map((x) => x.riga).join(', ')}${e.ignorate.length > 8 ? '…' : ''})` : ''}`);
    } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
    finally { setBusy(false); }
  }

  const daImportare = (scelte ?? []).filter((r) => r.includi);
  const senzaCategoria = daImportare.filter((r) => !r.cat).length;

  async function importa() {
    if (!confirm(`Importare ${daImportare.length} spese per ${eur(daImportare.reduce((n, r) => n + r.importo, 0))}?`)) return;
    setBusy(true); setErr('');
    try {
      const r = await api('importa-spese', { dati: { righe: daImportare.map((x) => ({ data: x.data, descrizione: x.descrizione, importo: x.importo, categoriaId: x.cat, metodo: x.metodo, ...destDa(x.dest) })) } }) as { inserite: number; saltate: number };
      setEsito(`Importate ${r.inserite} spese${r.saltate ? `, ${r.saltate} già presenti saltate` : ''}.`);
      setScelte(null); setRigheCsv(null); await onFatto();
    } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
    finally { setBusy(false); }
  }

  const colonne = righeCsv?.[0]?.map((c, i) => ({ i, t: mappa?.intestazione && c ? c : `Colonna ${i + 1}` })) ?? [];
  const sel = (k: 'data' | 'descrizione' | 'importo') => mappa && (
    <select value={mappa[k]} onChange={(e) => setMappa({ ...mappa, [k]: Number(e.target.value), dare: undefined, avere: undefined })}>{colonne.map((c) => <option key={c.i} value={c.i}>{c.t}</option>)}</select>
  );

  return (
    <div className="docgroup" style={{ marginBottom: 12 }}>
      <h3><span>Importa da estratto conto (CSV)</span></h3>
      <p className="sub">Scarica l&apos;estratto conto dalla banca in formato CSV e caricalo qui. Si importano solo le <b>uscite</b>; le entrate si ignorano. Vedi tutto in anteprima, abbini la categoria e confermi. Un movimento già importato non si duplica.</p>
      <input type="file" accept=".csv,.txt,text/csv" onChange={(e) => scegliFile(e.target.files?.[0] ?? null)} />
      {righeCsv && mappa && !scelte && (
        <div style={{ marginTop: 10 }}>
          <div className="form">
            <label>Colonna della data{sel('data')}</label>
            <label>Colonna della descrizione{sel('descrizione')}</label>
            {mappa.dare === undefined && <label>Colonna dell&apos;importo{sel('importo')}</label>}
            <label style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={mappa.intestazione} onChange={(e) => setMappa({ ...mappa, intestazione: e.target.checked })} style={{ width: 'auto' }} />La prima riga è l&apos;intestazione</label>
            {mappa.dare === undefined && <label style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={mappa.usciteNegative} onChange={(e) => setMappa({ ...mappa, usciteNegative: e.target.checked })} style={{ width: 'auto' }} />Le uscite hanno il segno meno</label>}
          </div>
          <small className="sub">Prime righe del file:</small>
          <div className="tablescroll"><table className="tbl"><tbody>{righeCsv.slice(0, 4).map((r, i) => <tr key={i}>{r.slice(0, 6).map((c, j) => <td key={j}><small>{c}</small></td>)}</tr>)}</tbody></table></div>
          <div className="modalactions"><button className="add" disabled={busy} onClick={anteprima}>{busy ? 'Controllo…' : 'Vedi anteprima'}</button></div>
        </div>
      )}
      {err && <p className="err">{err}</p>}
      {esito && <p className="empty" style={{ color: '#1FAA6E' }}>{esito}</p>}
      {scelte && (
        <>
          <p className="sub">{infoImport}. Le righe &quot;già presente&quot; sono spente: accendile solo se sono davvero spese diverse.</p>
          <div className="tablescroll">
            <table className="tbl full" style={{ minWidth: 760 }}>
              <thead><tr><th></th><th>Data</th><th>Descrizione</th><th className="num">€</th><th>Categoria</th><th>Dove</th></tr></thead>
              <tbody>
                {scelte.map((r, i) => (
                  <tr key={r.riga} style={r.includi ? undefined : { opacity: 0.55 }}>
                    <td><input type="checkbox" checked={r.includi} onChange={(e) => setScelte(scelte.map((x, k) => (k === i ? { ...x, includi: e.target.checked } : x)))} style={{ width: 'auto' }} /></td>
                    <td>{dataIt(r.data)}</td>
                    <td>{r.descrizione}{r.doppia && <small className="err"> · già presente</small>}</td>
                    <td className="num">{r.importo.toFixed(2).replace('.', ',')}</td>
                    <td>
                      <select value={r.cat} onChange={(e) => setScelte(scelte.map((x, k) => (k === i ? { ...x, cat: e.target.value } : x)))} style={!r.cat && r.includi ? { borderColor: '#E5484D' } : undefined}>
                        <option value="">— scegli —</option>{categorie.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                      {r.motivoCategoria && r.cat === r.categoriaId && <small className="sub"> {r.motivoCategoria}</small>}
                    </td>
                    <td><SelectDestinazione dati={dati} valore={r.dest} onChange={(d) => setScelte(scelte.map((x, k) => (k === i ? { ...x, dest: d } : x)))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modalactions">
            {senzaCategoria > 0 && <small className="err">{senzaCategoria} righe da importare non hanno la categoria.</small>}
            <button className="add" disabled={busy || daImportare.length === 0 || senzaCategoria > 0} onClick={importa}>{busy ? 'Importo…' : `Importa ${daImportare.length} spese`}</button>
            <button className="mini" onClick={() => setScelte(null)}>↩ indietro</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Spese ricorrenti ───────────────────────────────────────────────────────────────────────
function Ricorrenti({ dati, oggi, onCambiato }: { dati: Dati; oggi: string; onCambiato: () => Promise<void> }) {
  const cat = dati.categorieSpesa ?? [];
  const elenco = dati.speseRicorrenti ?? [];
  const [v, setV] = useState({ descrizione: '', categoriaId: cat[0]?.id ?? '', importo: '', dest: '' as Dest, frequenza: 'Mensile', primaData: oggi, fine: '', metodo: 'Bonifico' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  async function esegui(chiave: string, azione: string, id: string | undefined, dd?: Record<string, unknown>, conferma?: string) {
    if (conferma && !confirm(conferma)) return;
    setBusy(chiave); setErr('');
    try { await api(azione, { id, dati: dd }); await onCambiato(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }
  return (
    <div className="docgroup" style={{ marginBottom: 12 }}>
      <h3><span>Spese ricorrenti</span></h3>
      <p className="sub">Utenze, abbonamenti, commissioni: le registra da solo il gestionale alla data giusta (anche quelle arretrate), una volta sola. Puoi sospenderle o toglierle quando vuoi: le spese già registrate restano.</p>
      {elenco.length === 0 && <p className="empty">Nessuna spesa ricorrente.</p>}
      {elenco.map((r) => (
        <div key={r.id} className="docrow" style={{ flexWrap: 'wrap', gap: 8, opacity: r.attiva ? 1 : 0.55 }}>
          <b>{r.descrizione}</b><small className="sub">{r.categoria} · {r.alloggio ?? r.immobile ?? 'generale'} · {eur(Number(r.importo))} {r.frequenza.toLowerCase()} · prossima {dataIt(r.prossimaData)}{r.fine ? ` · fino al ${dataIt(r.fine)}` : ''}</small>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="mini" disabled={busy === 'a' + r.id} onClick={() => esegui('a' + r.id, 'imposta-spesa-ricorrente', r.id, { attiva: !r.attiva })}>{r.attiva ? '⏸ sospendi' : '▶ riattiva'}</button>
            <button className="mini" disabled={busy === 'd' + r.id} onClick={() => esegui('d' + r.id, 'elimina-spesa-ricorrente', r.id, undefined, `Togliere la ricorrenza "${r.descrizione}"? Le spese già registrate restano.`)}>🗑</button>
          </span>
        </div>
      ))}
      <h4 style={{ margin: '12px 0 4px' }}>Aggiungi una ricorrenza</h4>
      <div className="form">
        <label>Descrizione<input value={v.descrizione} onChange={(e) => setV({ ...v, descrizione: e.target.value })} placeholder="es. Abbonamento internet" /></label>
        <label>Categoria<select value={v.categoriaId} onChange={(e) => setV({ ...v, categoriaId: e.target.value })}>{cat.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label>Importo €<input inputMode="decimal" value={v.importo} onChange={(e) => setV({ ...v, importo: e.target.value })} /></label>
        <label>Immobile / alloggio<SelectDestinazione dati={dati} valore={v.dest} onChange={(d) => setV({ ...v, dest: d })} /></label>
        <label>Ogni<select value={v.frequenza} onChange={(e) => setV({ ...v, frequenza: e.target.value })}>{FREQ.map((f) => <option key={f}>{f}</option>)}</select></label>
        <label>Prima data<input type="date" value={v.primaData} onChange={(e) => setV({ ...v, primaData: e.target.value })} /></label>
        <label>Fino al (facoltativo)<input type="date" value={v.fine} onChange={(e) => setV({ ...v, fine: e.target.value })} /></label>
        <label>Metodo<select value={v.metodo} onChange={(e) => setV({ ...v, metodo: e.target.value })}>{METODI.map((m) => <option key={m}>{m}</option>)}</select></label>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="modalactions">
        <button className="add" disabled={busy === 'nuova' || !v.descrizione.trim() || !(Number(v.importo.replace(',', '.')) > 0) || !v.primaData}
          onClick={() => esegui('nuova', 'crea-spesa-ricorrente', undefined, { descrizione: v.descrizione, categoriaId: v.categoriaId, importo: Number(v.importo.replace(',', '.')), frequenza: v.frequenza, primaData: v.primaData, fine: v.fine || undefined, metodoPagamento: v.metodo, ...destDa(v.dest) })}>
          Aggiungi
        </button>
      </div>
    </div>
  );
}

// ── Export per il commercialista ───────────────────────────────────────────────────────────
function ExportCommercialista({ dati, anni, annoIniziale }: { dati: Dati; anni: number[]; annoIniziale: string }) {
  const [anno, setAnno] = useState(annoIniziale);
  const [prop, setProp] = useState('tutti');
  const base = `/api/nuovo/export-commercialista?anno=${anno}&proprietario=${prop}`;
  return (
    <div className="docgroup" style={{ marginBottom: 12 }}>
      <h3><span>Export per il commercialista</span></h3>
      <p className="sub">Incassi, commissioni, spese, tassa di soggiorno riscossa e versata, per anno e per proprietario. Le prenotazioni sono quelle con check-in nell&apos;anno, tutti i canali. Non ci sono i nomi degli ospiti. Il foglio "Riepilogo" spiega i criteri.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={anno} onChange={(e) => setAnno(e.target.value)}>{anni.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <select value={prop} onChange={(e) => setProp(e.target.value)}><option value="tutti">Tutti i proprietari</option>{dati.anagrafica.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        <a className="add" style={{ textDecoration: 'none' }} href={`${base}&formato=xlsx`}>⬇️ Excel (4 fogli)</a>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <small className="sub">Oppure un foglio in CSV:</small>
        {[['riepilogo', 'Riepilogo'], ['prenotazioni', 'Prenotazioni'], ['spese', 'Spese'], ['tassa', 'Tassa di soggiorno']].map(([k, t]) => <a key={k} className="mini" style={{ textDecoration: 'none' }} href={`${base}&formato=csv&foglio=${k}`}>{t}</a>)}
      </div>
    </div>
  );
}
