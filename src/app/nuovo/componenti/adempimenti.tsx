'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ArrivoAdempimento, StatoSinfonia } from '../tipi';
import { api, dataIt } from '../utilita';

// ── Adempimenti (solo Titolare) — punto 6 delle richieste, 23/11/2026 ─────────────────────────
// Arrivi del periodo con lo stato di ciascuno per Alloggiati Web, file da caricare sul portale e stato
// mensile di Sinfonia. NIENTE parte da qui: scarichi il file, lo carichi tu sul portale e segni "inviata".

const COLORI: Record<string, [string, string]> = {
  'Pronta': ['#1FAA6E22', '#1FAA6E'], 'Inviata': ['#1D6DF022', '#1D6DF0'], 'Da preparare': ['#FFB23822', '#C97A16'],
  'Con errore': ['#E5484D22', '#E5484D'], 'Da verificare': ['#8C7BD822', '#8C7BD8'], 'Non soggetta': ['#8884', '#6E6E73'],
};
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const aggiungi = (iso: string, giorni: number) => new Date(Date.parse(iso) + giorni * 864e5).toISOString().slice(0, 10);

export function SezioneAdempimenti({ oggi, onCambiato }: { oggi: string; onCambiato: () => Promise<void> }) {
  const [da, setDa] = useState(() => aggiungi(oggi, -3));
  const [a, setA] = useState(() => aggiungi(oggi, 7));
  const [arrivi, setArrivi] = useState<ArrivoAdempimento[] | null>(null);
  const [sinfonia, setSinfonia] = useState<StatoSinfonia[]>([]);
  const [anno, setAnno] = useState(new Date(oggi).getFullYear());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const carica = useCallback(async () => {
    setErr('');
    try {
      const r = await (await fetch(`/api/nuovo/adempimenti?da=${da}&a=${a}`)).json();
      if (!r.ok) throw new Error(r.error || 'Errore');
      setArrivi(r.arrivi); setSinfonia(r.sinfonia); setAnno(r.anno);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, [da, a]);
  useEffect(() => { carica(); }, [carica]);

  async function azione(chiave: string, nome: string, id: string | undefined, dati?: Record<string, unknown>, conferma?: string) {
    if (conferma && !confirm(conferma)) return;
    setBusy(chiave); setErr('');
    try { await api(nome, { id, dati }); await carica(); await onCambiato(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  const pronte = (arrivi ?? []).filter((x) => x.stato === 'Pronta');
  const preset = (d: number, u: number) => { setDa(aggiungi(oggi, d)); setA(aggiungi(oggi, u)); };

  return (
    <div className="grid">
      <div className="card">
        <h2>Adempimenti — Alloggiati Web</h2>
        <p className="sub">Niente parte da qui. Per ogni arrivo vedi se la schedina è pronta: scarichi il file, lo carichi tu sul portale e poi segni &quot;inviata&quot;. Il termine è 24 ore dall&apos;arrivo; l&apos;ora di arrivo non è registrata, quindi si conta in modo prudente: entro la fine del giorno di check-in.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0' }}>
          <button className="mini" onClick={() => preset(0, 0)}>oggi</button>
          <button className="mini" onClick={() => preset(-3, 7)}>da 3 giorni fa a 7 avanti</button>
          <button className="mini" onClick={() => preset(-30, 0)}>ultimi 30 giorni</button>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><small>dal</small><input type="date" value={da} onChange={(e) => e.target.value && setDa(e.target.value)} /></label>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}><small>al</small><input type="date" value={a} onChange={(e) => e.target.value && setA(e.target.value)} /></label>
          {pronte.length > 0 && (
            <a className="add" style={{ textDecoration: 'none', marginLeft: 'auto' }} href={`/api/nuovo/adempimenti/file?ids=${pronte.map((p) => p.prenotazioneId).join(',')}`}>
              ⬇️ Scarica il file di tutte le pronte ({pronte.length})
            </a>
          )}
        </div>
        {err && <p className="err">{err}</p>}
        {arrivi === null ? <p className="empty">Carico…</p> : arrivi.length === 0 ? <p className="empty">Nessun arrivo in questo periodo.</p> : (
          <div className="tablescroll">
            <table className="tbl full">
              <thead><tr><th>Arrivo</th><th>Alloggio e ospite</th><th>Ospiti / schedine</th><th>Stato</th><th>Termine</th><th></th></tr></thead>
              <tbody>
                {arrivi.map((x) => {
                  const [sfondo, testo] = COLORI[x.stato] ?? ['#8884', '#6E6E73'];
                  const attivo = x.stato !== 'Inviata' && x.stato !== 'Non soggetta';
                  return (
                    <tr key={x.prenotazioneId}>
                      <td><b>{dataIt(x.checkin)}</b><br /><small className="sub">fino al {dataIt(x.checkout)}</small></td>
                      <td>{x.alloggio}<br /><small className="sub">{x.ospite} · {x.canale}</small></td>
                      <td>{x.ospitiAttesi} / {x.schedine}</td>
                      <td>
                        <span className="chip" style={{ background: sfondo, color: testo }}>{x.stato}</span>
                        {x.motivi.map((m, i) => <div key={i}><small className={x.stato === 'Non soggetta' || x.stato === 'Inviata' ? 'sub' : 'err'}>{m}</small></div>)}
                      </td>
                      <td>
                        {!attivo ? <small className="sub">{x.inviataIl ? `inviata il ${new Date(x.inviataIl).toLocaleDateString('it-IT')}` : '—'}</small>
                          : x.inRitardo ? <b style={{ color: '#E5484D' }}>in ritardo</b>
                          : <small>{x.oreAllaScadenza <= 24 ? `tra ${Math.max(0, Math.round(x.oreAllaScadenza))} ore` : `tra ${Math.round(x.oreAllaScadenza / 24)} giorni`}</small>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {x.stato === 'Pronta' && <a className="mini" style={{ textDecoration: 'none' }} href={`/api/nuovo/adempimenti/file?ids=${x.prenotazioneId}`}>⬇️ file</a>}
                        {x.schedine > 0 && ['Pronta', 'Con errore', 'Da verificare'].includes(x.stato) && (
                          <button className="mini coral" disabled={busy === 's' + x.prenotazioneId}
                            onClick={() => azione('s' + x.prenotazioneId, 'segna-alloggiati-inviata', x.prenotazioneId, undefined,
                              `Confermi di aver caricato il file sul portale Alloggiati Web per ${x.alloggio}, arrivo ${dataIt(x.checkin)}, e che il portale lo ha accettato?\n\nLe schedine verranno segnate come inviate. Si può annullare.`)}>
                            ✓ segna inviata
                          </button>
                        )}
                        {x.stato === 'Inviata' && (
                          <button className="mini" disabled={busy === 'u' + x.prenotazioneId}
                            onClick={() => azione('u' + x.prenotazioneId, 'annulla-segna-alloggiati', x.prenotazioneId, undefined, 'Annullo il segno "inviata a mano"? Le schedine tornano "da inviare".')}>
                            ↩ annulla
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="empty" style={{ marginTop: 8 }}>L&apos;invio diretto dal gestionale resta nella scheda &quot;Alloggiati Web&quot;. Il file qui sopra ha il tracciato ufficiale (un record da 168 caratteri per ospite, persona di riferimento per prima) e contiene solo le prenotazioni pronte.</p>
      </div>

      <div className="card">
        <h2>Sinfonia — movimento turistico {anno}</h2>
        <p className="sub">Un file al mese per immobile. Lo scarichi, lo carichi sul portale regionale e segni il mese come inviato. I dati di provenienza mancanti sono stimati: il file è una bozza da confrontare col portale.</p>
        {sinfonia.length === 0 ? <p className="empty">Nessun immobile trasmette al portale regionale.</p> : sinfonia.map((s) => (
          <div key={s.immobileId} className="docgroup">
            <h3><span>{s.immobile}</span></h3>
            {s.mesi.map((m) => (
              <div key={m.mese} className="docrow" style={{ flexWrap: 'wrap', gap: 8 }}>
                <b style={{ minWidth: 40 }}>{MESI[m.mese - 1]}</b>
                <span className="chip" style={{ background: m.stato === 'Inviato' ? '#1D6DF022' : m.stato === 'Generato' ? '#FFB23822' : '#8884', color: m.stato === 'Inviato' ? '#1D6DF0' : m.stato === 'Generato' ? '#C97A16' : '#6E6E73' }}>{m.stato}</span>
                {m.inviatoIl && <small className="sub">inviato il {new Date(m.inviatoIl).toLocaleDateString('it-IT')}</small>}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <a className="mini" style={{ textDecoration: 'none' }} href={`/api/nuovo/sinfonia?immobile=${s.immobileId}&anno=${anno}&mese=${m.mese}&scarica=1`} onClick={() => setTimeout(carica, 1500)}>⬇️ file</a>
                  {m.stato !== 'Inviato'
                    ? <button className="mini" disabled={busy === `n${s.immobileId}${m.mese}`} onClick={() => azione(`n${s.immobileId}${m.mese}`, 'segna-sinfonia', undefined, { immobileId: s.immobileId, anno, mese: m.mese, inviato: true }, `Confermi di aver caricato il file di ${MESI[m.mese - 1]} ${anno} sul portale regionale?`)}>✓ segna inviato</button>
                    : <button className="mini" disabled={busy === `n${s.immobileId}${m.mese}`} onClick={() => azione(`n${s.immobileId}${m.mese}`, 'segna-sinfonia', undefined, { immobileId: s.immobileId, anno, mese: m.mese, inviato: false })}>↩ annulla</button>}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
