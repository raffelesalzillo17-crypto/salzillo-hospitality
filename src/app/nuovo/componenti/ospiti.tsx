'use client';

import { Fragment, useState } from 'react';
import type { Campo, Dati, Ospite } from '../tipi';
import { api, dataIt } from '../utilita';

// ── Scheda Ospiti (punto 4 delle richieste, 23/11/2026) ───────────────────────────────────
// Elenco con ricerca (nome, telefono, email), filtri (valutazione, ultimo soggiorno, numero di
// soggiorni), storico dei soggiorni di ogni ospite, "inverti nome/cognome" e, per il Titolare,
// lo strumento "Possibili duplicati" con unione guidata e il segno "record di prova".

export type Modale = { titolo: string; campi: Campo[]; azione: string; id?: string; iniziali?: Record<string, unknown> };
type Sess = { ruolo: string; puoModificare: boolean };

type Membro = {
  id: string; nome: string; cognome: string; telefono: string | null; email: string | null; codiceFiscale: string | null;
  valutazione: string; prenotazioni: number; collegati: number; ultimoSoggiorno: string | null; forseInvertito: boolean;
};
type Problemi = {
  gruppi: { motivi: string[]; principaleSuggerito: string; membri: Membro[] }[];
  invertiti: Membro[];
  sospetti: { id: string; nome: string; cognome: string; telefono: string | null; motivo: string; collegati: number }[];
};

const nomeCompleto = (o: { nome: string; cognome: string }) => `${o.cognome} ${o.nome}`.trim();

function statistiche(o: Ospite, oggi: string) {
  const attivi = (o.soggiorni ?? []).filter((s) => s.stato === 'Attiva');
  const passati = attivi.filter((s) => s.checkin <= oggi).map((s) => s.checkin).sort();
  return { numero: attivi.length, ultimo: passati.length ? passati[passati.length - 1] : null };
}

export function SezioneOspiti({ dati, sess, setModale, onCambiato }: {
  dati: Dati; sess: Sess; setModale: (m: Modale) => void; onCambiato: () => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [fVal, setFVal] = useState('');
  const [fUltimo, setFUltimo] = useState('');
  const [fNumero, setFNumero] = useState('');
  const [filtriAperti, setFiltriAperti] = useState(false);
  const [aperto, setAperto] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const PER_PAGINA = 12;
  const [strumento, setStrumento] = useState(false);
  const titolare = sess.ruolo === 'Titolare';

  const campiOspite: Campo[] = [
    { k: 'cognome', label: 'Cognome', req: true }, { k: 'nome', label: 'Nome', req: true },
    { k: 'telefono', label: 'Telefono (es. +39 333 1234567)' }, { k: 'email', label: 'Email' },
    { k: 'codiceFiscale', label: 'Codice fiscale' },
    { k: 'valutazione', label: 'Valutazione', tipo: 'select', opzioni: [{ v: 'Neutro', t: 'Neutro' }, { v: 'Buono', t: 'Buono' }, { v: 'Problematico', t: 'Problematico' }] },
    { k: 'note', label: 'Note' },
  ];

  const oggi = dati.oggi;
  const unAnnoFa = new Date(Date.parse(oggi) - 365 * 864e5).toISOString().slice(0, 10);
  const cerca = q.trim().toLowerCase();
  const lista = dati.ospiti.filter((o) => {
    if (cerca && !`${o.cognome} ${o.nome} ${o.telefono ?? ''} ${o.email ?? ''}`.toLowerCase().includes(cerca)) return false;
    if (fVal && o.valutazione !== fVal) return false;
    const st = statistiche(o, oggi);
    if (fUltimo === '12m' && !(st.ultimo && st.ultimo >= unAnnoFa)) return false;
    if (fUltimo === 'oltre12m' && !(st.ultimo && st.ultimo < unAnnoFa)) return false;
    if (fUltimo === 'mai' && st.ultimo) return false;
    if (fNumero === '0' && st.numero !== 0) return false;
    if (fNumero === '1' && st.numero !== 1) return false;
    if (fNumero === '2+' && st.numero < 2) return false;
    return true;
  });
  const filtrato = !!(cerca || fVal || fUltimo || fNumero);
  const pagine = Math.max(1, Math.ceil(lista.length / PER_PAGINA));
  const paginaSicura = Math.min(pagina, pagine - 1);
  const visibili = lista.slice(paginaSicura * PER_PAGINA, paginaSicura * PER_PAGINA + PER_PAGINA);
  function cambiaRicerca(valore: string) { setQ(valore); setPagina(0); }

  async function inverti(o: Ospite) {
    if (!confirm(`Scambiare nome e cognome?\n\nOra: "${nomeCompleto(o)}"\nDopo: "${o.nome} ${o.cognome}"`)) return;
    try { await api('inverti-ospite', { id: o.id }); await onCambiato(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="card card-libera">
      <div className="cardhead">
        <h2>Ospiti <small>({lista.length}{filtrato ? ` di ${dati.ospiti.length}` : ''})</small></h2>
        {titolare && <button className="add" onClick={() => setStrumento((x) => !x)}>{strumento ? 'Chiudi controlli' : '🔍 Possibili duplicati'}</button>}
        {sess.puoModificare && <button className="add" onClick={() => setModale({ titolo: 'Nuovo ospite', azione: 'crea-ospite', campi: campiOspite, iniziali: { valutazione: 'Neutro' } })}>＋ Ospite</button>}
      </div>

      {titolare && strumento && <StrumentoOspiti dati={dati} onCambiato={onCambiato} />}

      <div className="cerca-wrap cerca-sticky">
        <input className="cerca" placeholder="Cerca ospite" aria-label="Cerca ospite" value={q} onChange={(e) => cambiaRicerca(e.target.value)} />
        {q && <button type="button" className="cerca-x" aria-label="Svuota ricerca" onClick={() => cambiaRicerca('')}>✕</button>}
      </div>
      <button className="mini btnfiltri" style={{ margin: '8px 0 0' }} onClick={() => setFiltriAperti(!filtriAperti)}>{filtriAperti ? '✕ Chiudi filtri' : `🔎 Filtri${filtrato ? ' (attivi)' : ''}`}</button>
      <div className={'filtri' + (filtriAperti ? '' : ' chiuso')} style={{ margin: '8px 0' }}>
        <select value={fVal} onChange={(e) => { setFVal(e.target.value); setPagina(0); }} aria-label="Valutazione">
          <option value="">Valutazione: tutte</option><option value="Buono">Buono</option><option value="Neutro">Neutro</option><option value="Problematico">Problematico</option>
        </select>
        <select value={fUltimo} onChange={(e) => { setFUltimo(e.target.value); setPagina(0); }} aria-label="Ultimo soggiorno">
          <option value="">Ultimo soggiorno: qualsiasi</option><option value="12m">negli ultimi 12 mesi</option><option value="oltre12m">più di 12 mesi fa</option><option value="mai">mai soggiornato</option>
        </select>
        <select value={fNumero} onChange={(e) => { setFNumero(e.target.value); setPagina(0); }} aria-label="Numero di soggiorni">
          <option value="">Soggiorni: qualsiasi</option><option value="0">nessuno</option><option value="1">uno</option><option value="2+">due o più</option>
        </select>
        {filtrato && <button className="mini" onClick={() => { cambiaRicerca(''); setFVal(''); setFUltimo(''); setFNumero(''); }}>azzera filtri</button>}
      </div>

      <div className="ospiti-mobile">
        {visibili.map((o) => {
          const st = statistiche(o, oggi);
          const tel = (o.telefono ?? '').replace(/[^\d+]/g, '');
          const apertoQuesto = aperto === o.id;
          return (
            <div key={o.id} className="ospite-riga">
              <button type="button" className="ospite-apri" onClick={() => setAperto(apertoQuesto ? null : o.id)} aria-expanded={apertoQuesto}>
                <b>{nomeCompleto(o)}</b>
                <small>{st.ultimo ? `ultimo ${dataIt(st.ultimo)}` : 'nessun soggiorno'}</small>
              </button>
              {tel ? <a href={`tel:${tel}`}>{o.telefono}</a> : <span className="empty">senza telefono</span>}
              {apertoQuesto && (
                <div className="ospite-dettaglio">
                  {tel ? <a className="mini" href={`tel:${tel}`}>Chiama {o.telefono}</a> : <span className="empty">Nessun telefono</span>}
                  {o.email && <a className="mini" href={`mailto:${o.email}`}>{o.email}</a>}
                  <span className={`vchip v-${o.valutazione}`}>{o.valutazione}</span>
                  <span className="empty">{st.numero} soggiorni</span>
                  {(o.soggiorni ?? []).length === 0 ? <small className="empty">Nessun soggiorno registrato.</small> : (o.soggiorni ?? []).map((s) => (
                    <div key={s.id} className="row">{dataIt(s.checkin)} → {dataIt(s.checkout)} · {s.alloggio} · {s.canale}</div>
                  ))}
                  {sess.puoModificare && <button type="button" className="mini" onClick={() => setModale({
                    titolo: nomeCompleto(o), azione: 'aggiorna-ospite', id: o.id, campi: campiOspite,
                    iniziali: { cognome: o.cognome, nome: o.nome, telefono: o.telefono ?? '', email: o.email ?? '', codiceFiscale: o.codice_fiscale ?? '', valutazione: o.valutazione, note: o.note ?? '' },
                  })}>Modifica</button>}
                  {sess.puoModificare && o.cognome.trim() && <button type="button" className="mini" onClick={() => inverti(o)}>Scambia nome</button>}
                </div>
              )}
            </div>
          );
        })}
        {lista.length === 0 && <p className="empty">Nessun ospite trovato.</p>}
        {lista.length > PER_PAGINA && (
          <div className="pager">
            <button type="button" className="mini" disabled={paginaSicura === 0} onClick={() => setPagina(paginaSicura - 1)} aria-label="Pagina precedente">‹</button>
            <span>{paginaSicura + 1} / {pagine}</span>
            <button type="button" className="mini" disabled={paginaSicura >= pagine - 1} onClick={() => setPagina(paginaSicura + 1)} aria-label="Pagina successiva">›</button>
          </div>
        )}
      </div>
      <div className="tablescroll ospiti-desktop">
        <table className="tbl full">
          <thead><tr><th>Cognome</th><th>Nome</th><th>Telefono</th><th>Email</th><th>Valutazione</th><th>Soggiorni</th><th></th></tr></thead>
          <tbody>
            {lista.map((o) => {
              const st = statistiche(o, oggi);
              return (
                <Fragment key={o.id}>
                  <tr className={sess.puoModificare ? 'clic' : undefined}
                    onClick={() => sess.puoModificare && setModale({
                      titolo: nomeCompleto(o), azione: 'aggiorna-ospite', id: o.id, campi: campiOspite,
                      iniziali: { cognome: o.cognome, nome: o.nome, telefono: o.telefono ?? '', email: o.email ?? '', codiceFiscale: o.codice_fiscale ?? '', valutazione: o.valutazione, note: o.note ?? '' },
                    })}>
                    <td>{o.cognome}</td><td>{o.nome}</td><td>{o.telefono ? <a href={`tel:${o.telefono.replace(/[^\d+]/g, '')}`} onClick={(e) => e.stopPropagation()}>{o.telefono}</a> : '—'}</td><td>{o.email || '—'}</td>
                    <td><span className={`vchip v-${o.valutazione}`}>{o.valutazione}</span></td>
                    <td><small>{st.numero}{st.ultimo ? ` · ultimo ${dataIt(st.ultimo)}` : ''}</small></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="mini" title="Storico dei soggiorni" onClick={(e) => { e.stopPropagation(); setAperto(aperto === o.id ? null : o.id); }}>{aperto === o.id ? '▴ storico' : '▾ storico'}</button>
                      {sess.puoModificare && o.cognome.trim() && <button className="mini" title="Scambia nome e cognome" onClick={(e) => { e.stopPropagation(); inverti(o); }}>↔</button>}
                      {titolare && (
                        <button className="mini" title="Elimina (va nel cestino per 30 giorni)" onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Eliminare ${nomeCompleto(o)}? Funziona solo se non ha prenotazioni/preventivi/documenti agganciati. Resta nel cestino 30 giorni.`)) return;
                          try { await api('elimina-ospite', { id: o.id }); await onCambiato(); }
                          catch (err) { alert(err instanceof Error ? err.message : String(err)); }
                        }}>🗑</button>
                      )}
                    </td>
                  </tr>
                  {aperto === o.id && (
                    <tr><td colSpan={7} style={{ background: 'var(--bg)' }}>
                      {(o.soggiorni ?? []).length === 0 ? <small className="empty">Nessun soggiorno registrato.</small> : (
                        <table className="tbl" style={{ margin: 0 }}><tbody>
                          {(o.soggiorni ?? []).map((s) => (
                            <tr key={s.id}><td>{dataIt(s.checkin)} → {dataIt(s.checkout)}</td><td>{s.alloggio}</td><td>{s.canale}</td><td><small>{s.stato}</small></td></tr>
                          ))}
                        </tbody></table>
                      )}
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
            {lista.length === 0 && <tr><td colSpan={7} className="empty">Nessun ospite trovato.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Strumento "Possibili duplicati" (solo Titolare) ───────────────────────────────────────
function StrumentoOspiti({ dati, onCambiato }: { dati: Dati; onCambiato: () => Promise<void> }) {
  const [p, setP] = useState<Problemi | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [principale, setPrincipale] = useState<Record<number, string>>({});
  const [daUnire, setDaUnire] = useState<Record<string, boolean>>({});
  const proveNascoste = dati.ospitiDiProva ?? [];

  async function carica() {
    setBusy('cerca'); setErr('');
    try {
      const r = await api('cerca-problemi-ospiti') as Problemi;
      setP(r);
      const pr: Record<number, string> = {}; const du: Record<string, boolean> = {};
      r.gruppi.forEach((g, i) => { pr[i] = g.principaleSuggerito; g.membri.forEach((m) => { du[m.id] = m.id !== g.principaleSuggerito; }); });
      setPrincipale(pr); setDaUnire(du);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  async function esegui(chiave: string, azione: string, id: string, datiAzione?: Record<string, unknown>, conferma?: string, ok?: string) {
    if (conferma && !confirm(conferma)) return;
    setBusy(chiave); setErr(''); setMsg('');
    try { await api(azione, { id, dati: datiAzione }); if (ok) setMsg(ok); await onCambiato(); await carica(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  async function unisci(i: number, g: Problemi['gruppi'][number]) {
    const princ = g.membri.find((m) => m.id === principale[i]) ?? g.membri[0];
    const altri = g.membri.filter((m) => m.id !== princ.id && daUnire[m.id]);
    if (altri.length === 0) { setErr('Spunta almeno un ospite da unire al principale.'); return; }
    const spostati = altri.reduce((n, m) => n + m.collegati, 0);
    if (!confirm(`Unire ${altri.length} ospit${altri.length === 1 ? 'e' : 'i'} in "${nomeCompleto(princ)}"?\n\n` +
      `• prenotazioni, schedine, documenti e preventivi (${spostati} in tutto) passano tutti sul principale;\n` +
      `• i dati mancanti (telefono, email, codice fiscale) vengono completati;\n` +
      `• i record uniti restano 30 giorni nel cestino.\n\nProcedo?`)) return;
    setBusy(`u${i}`); setErr(''); setMsg('');
    try {
      const r = await api('unisci-ospiti', { id: princ.id, dati: { daUnire: altri.map((m) => m.id) } }) as { spostate: Record<string, number> };
      const s = r.spostate;
      setMsg(`Unione fatta: spostate ${s.prenotazioni} prenotazioni, ${s.schedine} schedine, ${s.documenti} documenti, ${s.preventivi} preventivi.`);
      await onCambiato(); await carica();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  return (
    <div className="docgroup" style={{ marginBottom: 12 }}>
      <h3><span>Controlli sull&apos;elenco ospiti</span><button className="mini" disabled={busy === 'cerca'} onClick={carica}>{busy === 'cerca' ? 'cerco…' : p ? '↻ ricontrolla' : 'Cerca'}</button></h3>
      <p className="sub">Niente si unisce o si cancella da solo. Scegli tu la scheda principale e confermi: le prenotazioni delle altre passano tutte su quella e il programma controlla che non se ne perda nessuna.
    </p>
      {err && <p className="err">{err}</p>}
      {msg && <p className="empty" style={{ color: '#1FAA6E' }}>{msg}</p>}
      {p && (
        <>
          <h4 style={{ margin: '10px 0 4px' }}>Possibili duplicati ({p.gruppi.length})</h4>
          {p.gruppi.length === 0 && <p className="empty">Nessun duplicato trovato.</p>}
          {p.gruppi.map((g, i) => (
            <div key={i} className="docrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <small className="empty">Motivo: {g.motivi.join(' · ')}</small>
              {g.membri.map((m) => (
                <label key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="radio" name={`princ-${i}`} checked={principale[i] === m.id} onChange={() => setPrincipale({ ...principale, [i]: m.id })} style={{ width: 'auto' }} title="Record principale" />
                  <b>{nomeCompleto(m)}</b>
                  <small className="empty">{m.telefono || 'senza telefono'} · {m.email || 'senza email'} · {m.prenotazioni} prenotazioni{m.ultimoSoggiorno ? ` · ultima ${dataIt(m.ultimoSoggiorno)}` : ''}</small>
                  {principale[i] === m.id
                    ? <span className="pill pill-Accettato">principale</span>
                    : <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={!!daUnire[m.id]} onChange={(e) => setDaUnire({ ...daUnire, [m.id]: e.target.checked })} style={{ width: 'auto' }} /><small>unisci</small></span>}
                </label>
              ))}
              <div><button className="mini coral" disabled={busy === `u${i}`} onClick={() => unisci(i, g)}>{busy === `u${i}` ? 'unisco…' : 'Unisci nel principale'}</button></div>
            </div>
          ))}

          <h4 style={{ margin: '14px 0 4px' }}>Nome e cognome forse invertiti ({p.invertiti.length})</h4>
          {p.invertiti.length === 0 && <p className="empty">Nessuno.</p>}
          {p.invertiti.map((m) => (
            <div key={m.id} className="docrow">
              <b>{nomeCompleto(m)}</b><small className="empty">(cognome: {m.cognome} · nome: {m.nome}) {m.prenotazioni} prenotazioni</small>
              <button className="mini" style={{ marginLeft: 'auto' }} disabled={busy === `i${m.id}`} onClick={() => esegui(`i${m.id}`, 'inverti-ospite', m.id, undefined, `Scambiare nome e cognome? Diventa "${m.nome} ${m.cognome}".`)}>↔ Inverti</button>
            </div>
          ))}

          <h4 style={{ margin: '14px 0 4px' }}>Record di prova o vuoti ({p.sospetti.length})</h4>
          <p className="sub">Si possono nascondere (&quot;di prova&quot;) senza perdere niente, oppure eliminare con conferma (restano 30 giorni nel cestino).</p>
          {p.sospetti.length === 0 && <p className="empty">Nessuno.</p>}
          {p.sospetti.map((s) => (
            <div key={s.id} className="docrow">
              <b>{nomeCompleto(s)}</b><small className="empty">{s.motivo}</small>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className="mini" disabled={busy === `p${s.id}`} onClick={() => esegui(`p${s.id}`, 'segna-ospite-prova', s.id, { valore: true }, `Segnare "${nomeCompleto(s)}" come record di prova? Sparisce da elenchi e ricerche, ma non viene eliminato.`)}>🧪 Segna di prova</button>
                {s.collegati === 0 && <button className="mini" disabled={busy === `e${s.id}`} onClick={() => esegui(`e${s.id}`, 'elimina-ospite', s.id, undefined, `Eliminare "${nomeCompleto(s)}"? Resta 30 giorni nel cestino.`)}>🗑 Elimina</button>}
              </span>
            </div>
          ))}
        </>
      )}

      {proveNascoste.length > 0 && (
        <>
          <h4 style={{ margin: '14px 0 4px' }}>Segnati di prova, nascosti ({proveNascoste.length})</h4>
          {proveNascoste.map((s) => (
            <div key={s.id} className="docrow">
              <b>{nomeCompleto(s)}</b>
              <button className="mini" style={{ marginLeft: 'auto' }} disabled={busy === `n${s.id}`} onClick={() => esegui(`n${s.id}`, 'segna-ospite-prova', s.id, { valore: false })}>↩ Rimetti nell&apos;elenco</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
