'use client';

import { useEffect, useState } from 'react';
import type { Anagrafica, DocumentoCaricato, Rendiconto } from '../tipi';
import { dataIt, eur, neg } from '../utilita';

// ── Rendiconti proprietario ────────────────────────────────────────────────
export function Rendiconti({ anagrafica, oggi, documenti }: { anagrafica: Anagrafica; oggi: string; documenti: DocumentoCaricato[] }) {
  const [propId, setPropId] = useState(anagrafica[0]?.id ?? '');
  const [ambito, setAmbito] = useState(''); // '' = tutti; 'imm:<id>' | 'all:<id>'
  const now = new Date(oggi);
  const [anno, setAnno] = useState(now.getFullYear());
  const [mese, setMese] = useState(now.getMonth() + 1);
  const [r, setR] = useState<Rendiconto | null>(null);
  const [caricando, setCaricando] = useState(false);

  const prop = anagrafica.find((p) => p.id === propId);
  const ambitoQ = ambito.startsWith('imm:') ? `&immobile=${ambito.slice(4)}` : ambito.startsWith('all:') ? `&alloggio=${ambito.slice(4)}` : '';

  useEffect(() => { setAmbito(''); }, [propId]);
  useEffect(() => {
    if (!propId) return;
    setCaricando(true);
    fetch(`/api/nuovo/rendiconto?proprietario=${propId}&anno=${anno}&mese=${mese}${ambitoQ}`)
      .then((x) => x.json()).then((d) => setR(d.ok ? d.rendiconto : null)).finally(() => setCaricando(false));
  }, [propId, anno, mese, ambitoQ]);

  const meseNome = new Date(anno, mese - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const meseBreve = (a: number, m: number) => new Date(a, m - 1).toLocaleDateString('it-IT', { month: 'long' });
  const pdfHref = `/api/nuovo/rendiconto/pdf?proprietario=${propId}&anno=${anno}&mese=${mese}${ambitoQ}`;

  return (
    <div className="card">
      <div className="rendctl">
        <select value={propId} onChange={(e) => setPropId(e.target.value)}>
          <option value="tutti">— Tutti i proprietari —</option>
          {anagrafica.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={mese} onChange={(e) => setMese(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i).toLocaleDateString('it-IT', { month: 'long' })}</option>)}
        </select>
        <select value={anno} onChange={(e) => setAnno(Number(e.target.value))}>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {prop && (prop.immobili.length > 1 || prop.immobili.some((i) => i.alloggi.length > 1)) && (
        <div className="rendctl" style={{ marginTop: 8 }}>
          <select value={ambito} onChange={(e) => setAmbito(e.target.value)} style={{ minWidth: 220 }}>
            <option value="">Tutti gli immobili di {prop.nome}</option>
            {prop.immobili.map((im) => (
              <optgroup key={im.id} label={im.nome}>
                <option value={`imm:${im.id}`}>{im.nome} — tutto l&apos;immobile</option>
                {im.alloggi.map((al) => <option key={al.id} value={`all:${al.id}`}>{al.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      {caricando ? <p className="empty">Carico…</p> : !r ? <p className="empty">Nessun dato.</p> : (
        <>
          <h2>{r.proprietario} · <span style={{ textTransform: 'capitalize' }}>{meseNome}</span></h2>
          {r.ambito.tipo !== 'tutto' && <p className="sub" style={{ marginTop: -6 }}>{r.ambito.etichetta}</p>}

          <div className="kpirow">
            <div className="kpi"><span>Prenotazioni</span><b>{r.totali.numPrenotazioni}</b></div>
            <div className="kpi"><span>Incassato lordo</span><b>{eur(r.totali.lordo)}</b></div>
            <div className="kpi coral"><span>Spetta al proprietario</span><b>{eur(r.totali.nettoFinale)}</b></div>
          </div>

          <div className="tablescroll">
            <table className="tbl" style={{ marginTop: 16 }}>
              <thead><tr><th>Confronto</th><th className="num">Prenot.</th><th className="num">Lordo</th><th className="num">Netto propr.</th></tr></thead>
              <tbody>
                <tr><td><b><span style={{ textTransform: 'capitalize' }}>{meseNome}</span></b></td><td className="num strong">{r.totali.numPrenotazioni}</td><td className="num">{eur(r.totali.lordo)}</td><td className="num strong">{eur(r.totali.nettoProprietario)}</td></tr>
                <tr><td style={{ textTransform: 'capitalize' }}>Mese scorso ({meseBreve(r.confronti.meseScorso.anno, r.confronti.meseScorso.mese)})</td><td className="num">{r.confronti.meseScorso.prenotazioni}</td><td className="num">{eur(r.confronti.meseScorso.lordo)}</td><td className="num">{eur(r.confronti.meseScorso.nettoProprietario)}</td></tr>
                <tr><td>Stesso mese {anno - 1}</td><td className="num">{r.confronti.annoScorso.prenotazioni}</td><td className="num">{eur(r.confronti.annoScorso.lordo)}</td><td className="num">{eur(r.confronti.annoScorso.nettoProprietario)}</td></tr>
              </tbody>
            </table>
          </div>

          {r.righe.length === 0 ? <p className="empty" style={{ marginTop: 12 }}>Nessuna prenotazione questo mese.</p> : (
            <div className="tablescroll">
              <table className="tbl full">
                <thead><tr><th>Check-in</th><th>Ospite</th><th>Alloggio</th><th>Canale</th><th className="num">Lordo</th><th className="num">Commiss.</th><th className="num">Cedolare</th><th className="num">Pulizia</th><th className="num">Fee</th><th className="num">Netto propr.</th></tr></thead>
                <tbody>
                  {r.righe.map((x) => (
                    <tr key={x.id}>
                      <td>{dataIt(x.checkin)}</td><td>{x.ospite}</td><td>{x.alloggio}</td><td>{x.canale}</td>
                      <td className="num">{eur(Number(x.lordo))}</td><td className="num">{neg(Number(x.commissione))}</td>
                      <td className="num">{neg(Number(x.cedolare))}</td><td className="num">{neg(Number(x.costoPulizia))}</td>
                      <td className="num">{neg(Number(x.feeGestione))}</td><td className="num strong">{eur(Number(x.nettoProprietario))}</td>
                    </tr>
                  ))}
                  <tr className="tot">
                    <td colSpan={4}>Totale prenotazioni ({r.righe.length})</td>
                    <td className="num">{eur(r.totali.lordo)}</td><td className="num">{neg(r.totali.commissione)}</td>
                    <td className="num">{neg(r.totali.cedolare)}</td><td className="num">{neg(r.totali.costoPulizia)}</td>
                    <td className="num">{neg(r.totali.feeGestione)}</td><td className="num strong">{eur(r.totali.nettoProprietario)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {r.spese.length > 0 && (
            <div className="tablescroll">
              <table className="tbl" style={{ marginTop: 16 }}>
                <thead><tr><th>Spese del mese</th><th></th><th className="num">Importo</th></tr></thead>
                <tbody>
                  {r.spese.map((s) => <tr key={s.id}><td>{dataIt(s.data)} · {s.categoria}</td><td>{s.descrizione}</td><td className="num">−{eur(Number(s.importo))}</td></tr>)}
                  <tr className="tot"><td colSpan={2}>Totale spese</td><td className="num">−{eur(r.totali.totSpese)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="sub" style={{ marginTop: 8 }}>Costi di pulizia: {neg(r.totali.costoPulizia)} · Fee di gestione: {neg(r.totali.feeGestione)}</p>
          {r.totali.impostaSoggiorno > 0 && <p className="sub">Imposta di soggiorno incassata dagli ospiti (da versare al comune): {eur(r.totali.impostaSoggiorno)}</p>}

          <div className="previsione">
            <span>Previsione <span style={{ textTransform: 'capitalize' }}>{meseBreve(r.confronti.previsione.anno, r.confronti.previsione.mese)}</span></span>
            <p>Già acquisite <b>{r.confronti.previsione.acquisito.prenotazioni} prenotazioni</b> per {eur(r.confronti.previsione.acquisito.lordo)} di lordo.</p>
            <p className="empty">Stesso mese l&apos;anno scorso: {r.confronti.previsione.annoScorso.prenotazioni} prenotazioni, {eur(r.confronti.previsione.annoScorso.lordo)} di lordo.</p>
          </div>

          <div className="rendtot">
            <span>Spetta al proprietario</span>
            <b>{eur(r.totali.nettoFinale)}</b>
          </div>
          <p style={{ marginTop: 12 }}>
            <a className="sync" href={`${pdfHref}&download=1`} target="_blank" rel="noopener" style={{ textDecoration: 'none', display: 'inline-block' }}>📄 Scarica il PDF</a>
          </p>
          <p className="empty" style={{ marginTop: 8 }}>Fee di gestione: 0% (immobile di famiglia).</p>
          {(() => {
            const salvati = documenti.filter((d) => d.tipo === 'Rendiconto' && d.proprietarioId === propId);
            if (salvati.length === 0) return null;
            return (
              <div style={{ marginTop: 14 }}>
                <b style={{ fontSize: 13 }}>Rendiconti salvati su Drive per {r.proprietario}</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {salvati.slice(0, 12).map((d) => (
                    <li key={d.id} style={{ fontSize: 12.5 }}>
                      {d.driveUrl ? <a href={d.driveUrl} target="_blank" rel="noopener">{d.nome}</a> : d.nome}
                      {' — '}<span className="empty">{dataIt(d.caricatoIl.slice(0, 10))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
