'use client';

import { useEffect, useState } from 'react';
import { eur } from '../utilita';
import { NOMI_MESI, type Resoconto, type confrontoAnni } from '@/lib/resocontoAnnuale';

// Resoconto annuale (punto 14): stesse definizioni di Dashboard e Rendiconti (prenotazioni attive per mese di check-in).
type Dati = { corrente: Resoconto; precedente: Resoconto; confronto: ReturnType<typeof confrontoAnni> };

const pct = (x: number | null) => (x === null ? '—' : `${x > 0 ? '+' : ''}${x.toLocaleString('it-IT')}%`);
const num = (x: number) => x.toLocaleString('it-IT');

export function ResocontoAnnuale({ oggi }: { oggi: string }) {
  const [anno, setAnno] = useState(Number(oggi.slice(0, 4)));
  const [d, setD] = useState<Dati | null>(null);
  const [err, setErr] = useState('');
  const [caricando, setCaricando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCaricando(true); setErr('');
    fetch(`/api/nuovo/resoconto-annuale?anno=${anno}`).then((r) => r.json()).then((x) => {
      if (!vivo) return;
      if (x.ok) setD(x); else { setD(null); setErr(x.error ?? 'Errore'); }
    }).catch((e) => { if (vivo) setErr(String(e)); }).finally(() => { if (vivo) setCaricando(false); });
    return () => { vivo = false; };
  }, [anno]);

  const anni = Array.from({ length: 6 }, (_, i) => Number(oggi.slice(0, 4)) - i);
  const c = d?.corrente, p = d?.precedente, k = d?.confronto;

  return (
    <div className="card">
      <div className="cardhead">
        <h2>Resoconto annuale <small>· per anno fiscale</small></h2>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={anno} onChange={(e) => setAnno(Number(e.target.value))}>{anni.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <a className="mini" href={`/api/nuovo/resoconto-annuale?anno=${anno}&formato=xlsx`} style={{ textDecoration: 'none' }}>⬇ Excel (5 fogli)</a>
          <a className="mini" href={`/api/nuovo/resoconto-annuale?anno=${anno}&formato=csv&foglio=mesi`} style={{ textDecoration: 'none' }}>⬇ CSV mesi</a>
        </span>
      </div>
      <p className="sub" style={{ marginTop: -4 }}>
        Prenotazioni attive, assegnate al mese del check-in (come Dashboard e Rendiconti: i totali coincidono). Occupazione = notti occupate / (alloggi attivi × giorni);
        per il confronto si usa lo stesso numero di alloggi attivi di oggi.
      </p>
      {err && <p className="err">{err}</p>}
      {caricando && !d && <p className="empty">Calcolo…</p>}
      {c && p && k && (
        <>
          <div className="tablescroll">
            <table className="tbl full">
              <thead><tr><th>Mese</th><th className="num">Prenotazioni</th><th className="num">Incasso lordo</th><th className="num">Tassa di soggiorno</th><th className="num">Notti</th><th className="num">Occupazione</th><th className="num">Lordo {p.anno}</th></tr></thead>
              <tbody>
                {c.mesi.map((m, i) => (
                  <tr key={m.mese}>
                    <td>{NOMI_MESI[i]}</td><td className="num">{m.prenotazioni}</td><td className="num">{eur(m.lordo)}</td><td className="num">{eur(m.tassa)}</td>
                    <td className="num">{m.nottiOccupate}</td><td className="num">{num(m.occupazione)}%</td><td className="num">{eur(p.mesi[i].lordo)}</td>
                  </tr>
                ))}
                <tr className="tot"><td>Totale {c.anno}</td><td className="num">{c.totali.prenotazioni}</td><td className="num">{eur(c.totali.lordo)}</td><td className="num">{eur(c.totali.tassa)}</td>
                  <td className="num">{c.totali.nottiOccupate}</td><td className="num">{num(c.totali.occupazione)}%</td><td className="num">{eur(p.totali.lordo)}</td></tr>
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 16 }}>Confronto con il {p.anno}</h3>
          <div className="tablescroll">
            <table className="tbl full">
              <thead><tr><th>Voce</th><th className="num">{c.anno}</th><th className="num">{p.anno}</th><th className="num">Differenza</th><th className="num">Variazione</th></tr></thead>
              <tbody>
                {([['Prenotazioni', k.prenotazioni, false], ['Incasso lordo', k.lordo, true], ['Tassa di soggiorno', k.tassa, true], ['Notti occupate', k.nottiOccupate, false], ['Occupazione', k.occupazione, false]] as const).map(([voce, x, euro]) => (
                  <tr key={voce}>
                    <td>{voce}</td>
                    <td className="num">{euro ? eur(x.corrente) : voce === 'Occupazione' ? `${num(x.corrente)}%` : num(x.corrente)}</td>
                    <td className="num">{euro ? eur(x.precedente) : voce === 'Occupazione' ? `${num(x.precedente)}%` : num(x.precedente)}</td>
                    <td className="num">{euro ? eur(x.differenza) : voce === 'Occupazione' ? `${num(x.differenza)} punti` : num(x.differenza)}</td>
                    <td className="num">{pct(x.percentuale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 16 }}>Incassi per canale</h3>
          <div className="tablescroll">
            <table className="tbl full">
              <thead><tr><th>Canale</th><th className="num">Prenotazioni</th><th className="num">Incasso lordo</th><th className="num">{p.anno}: prenotazioni</th><th className="num">{p.anno}: lordo</th></tr></thead>
              <tbody>
                {[...new Set([...c.perCanale.map((x) => x.canale), ...p.perCanale.map((x) => x.canale)])].sort().map((can) => {
                  const a = c.perCanale.find((x) => x.canale === can), b = p.perCanale.find((x) => x.canale === can);
                  return <tr key={can}><td>{can}</td><td className="num">{a?.prenotazioni ?? 0}</td><td className="num">{eur(a?.lordo ?? 0)}</td><td className="num">{b?.prenotazioni ?? 0}</td><td className="num">{eur(b?.lordo ?? 0)}</td></tr>;
                })}
                {c.perCanale.length === 0 && p.perCanale.length === 0 && <tr><td colSpan={5} className="empty">Nessuna prenotazione in questi due anni.</td></tr>}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 16 }}>Per regime fiscale</h3>
          <div className="tablescroll">
            <table className="tbl full">
              <thead><tr><th>Regime</th><th className="num">Prenotazioni</th><th className="num">Incasso lordo</th><th className="num">Tassa di soggiorno</th><th className="num">{p.anno}: prenotazioni</th><th className="num">{p.anno}: lordo</th></tr></thead>
              <tbody>
                {[...new Set([...c.perRegime.map((x) => x.regime), ...p.perRegime.map((x) => x.regime)])].sort().map((reg) => {
                  const a = c.perRegime.find((x) => x.regime === reg), b = p.perRegime.find((x) => x.regime === reg);
                  return <tr key={reg}><td>{reg}</td><td className="num">{a?.prenotazioni ?? 0}</td><td className="num">{eur(a?.lordo ?? 0)}</td><td className="num">{eur(a?.tassa ?? 0)}</td><td className="num">{b?.prenotazioni ?? 0}</td><td className="num">{eur(b?.lordo ?? 0)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 16 }}>Tassa di soggiorno per alloggio e mese</h3>
          {c.tassaPerAlloggio.length === 0
            ? <p className="empty">Nessuna tassa riscossa nel {c.anno} (o gli alloggi non hanno un importo di tassa impostato).</p>
            : (
              <div className="tablescroll">
                <table className="tbl full">
                  <thead><tr><th>Alloggio</th>{NOMI_MESI.map((m) => <th key={m} className="num">{m.slice(0, 3)}</th>)}<th className="num">Totale</th></tr></thead>
                  <tbody>
                    {c.tassaPerAlloggio.map((x) => (
                      <tr key={x.alloggio}><td>{x.alloggio}</td>{x.mesi.map((v, i) => <td key={i} className="num">{v ? eur(v) : '·'}</td>)}<td className="num strong">{eur(x.totale)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}
    </div>
  );
}
