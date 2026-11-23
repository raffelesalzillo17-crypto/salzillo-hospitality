'use client';

import { useEffect, useRef, useState } from 'react';
import type { Operatore, Pulizia } from '../tipi';
import { api, dataIt, eur } from '../utilita';

// ── Pulizie (punto 9 delle richieste, 23/11/2026) ──────────────────────────────────────────
// Una pulizia si segna "fatta" solo dal giorno del check-out; la conferma è a due passaggi (tocco e poi "Confermi?") e dopo la
// conferma c'è sempre un annullo per 10 secondi, così un tocco accidentale non resta. Addetto, orario, note e checklist per alloggio.

const ATTESA_CONFERMA_S = 6;
const ANNULLO_S = 10;

/** Pulsante "fatto" a due passaggi con annullo. `conferma` scrive; `annulla` toglie il "fatto"; `finito` ricarica i dati (dopo l'annullo o a fine conto alla rovescia). */
export function BottoneFatto({ disabilitato, motivo, conferma, annulla, finito, messaggioExtra }: {
  disabilitato?: boolean; motivo?: string; conferma: () => Promise<void>; annulla: () => Promise<void>; finito: () => Promise<void>; messaggioExtra?: string;
}) {
  const [fase, setFase] = useState<'pronto' | 'chiedi' | 'fatta'>('pronto');
  const [resto, setResto] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function conto(secondi: number, alloScadere: () => void) {
    if (timer.current) clearInterval(timer.current);
    setResto(secondi);
    let r = secondi;
    timer.current = setInterval(() => { r -= 1; setResto(r); if (r <= 0) { if (timer.current) clearInterval(timer.current); alloScadere(); } }, 1000);
  }

  function primoTocco() {
    setErr(''); setFase('chiedi');
    conto(ATTESA_CONFERMA_S, () => setFase('pronto'));
  }
  async function secondoTocco() {
    if (timer.current) clearInterval(timer.current);
    setBusy(true); setErr('');
    try {
      await conferma();
      setFase('fatta');
      conto(ANNULLO_S, () => { setFase('pronto'); finito(); });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setFase('pronto'); }
    finally { setBusy(false); }
  }
  async function annullaTutto() {
    if (timer.current) clearInterval(timer.current);
    setBusy(true); setErr('');
    try { await annulla(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setFase('pronto'); await finito(); }
  }

  if (disabilitato) return <small className="sub" title={motivo}>{motivo ?? 'non ancora'}</small>;
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {fase === 'pronto' && <button className="mini" disabled={busy} onClick={primoTocco}>✓ fatto</button>}
      {fase === 'chiedi' && <>
        <button className="mini coral" disabled={busy} onClick={secondoTocco}>{busy ? '…' : `Confermi? (${resto})`}</button>
        <button className="mini" onClick={() => { if (timer.current) clearInterval(timer.current); setFase('pronto'); }}>no</button>
        {messaggioExtra && <small className="err">{messaggioExtra}</small>}
      </>}
      {fase === 'fatta' && <>
        <span className="chip" style={{ background: '#1FAA6E22', color: '#1FAA6E' }}>✓ fatta</span>
        <button className="mini" disabled={busy} onClick={annullaTutto}>↩ annulla ({resto})</button>
      </>}
      {err && <small className="err">{err}</small>}
    </span>
  );
}

export function RigaPulizia({ pu, operatori, oggi, puoGestire, ruolo, onCambiato }: {
  pu: Pulizia; operatori: Operatore[]; oggi: string; puoGestire: boolean; ruolo: string; onCambiato: () => Promise<void>;
}) {
  const gestisce = ruolo === 'Titolare' || ruolo === 'Collaboratore';
  const checklist = pu.checklist ?? [];
  const [spunte, setSpunte] = useState<string[]>(pu.checklistFatta ?? []);
  const [ora, setOra] = useState(pu.oraPrevista ?? '');
  const [nota, setNota] = useState(pu.note ?? '');
  const [errore, setErrore] = useState('');
  const urgente = pu.prossimoCheckin === pu.data;
  const presto = !urgente && pu.prossimoCheckin && Math.round((Date.parse(pu.prossimoCheckin) - Date.parse(pu.data)) / 864e5) <= 2;
  const ancoraNo = pu.data > oggi;
  const mancano = checklist.filter((v) => !spunte.includes(v));

  async function salva(dati: Record<string, unknown>) {
    setErrore('');
    try { await api('aggiorna-pulizia', { id: pu.id, dati }); }
    catch (e) { setErrore(e instanceof Error ? e.message : String(e)); }
  }
  function spunta(voce: string) {
    const n = spunte.includes(voce) ? spunte.filter((x) => x !== voce) : [...spunte, voce];
    setSpunte(n); salva({ checklistFatta: n });
  }

  return (
    <div className="docrow" style={{ flexWrap: 'wrap', gap: 8, ...(urgente ? { borderLeft: '3px solid #E5484D', paddingLeft: 8 } : {}) }}>
      <span className={`pill ${pu.data < oggi ? 'pill-Scaduto' : 'pill-Bozza'}`}>{dataIt(pu.data)}</span>
      <b>{pu.alloggio}</b>
      {urgente && <span className="chip" style={{ background: '#E5484D22', color: '#E5484D', fontWeight: 800 }}>⚡ URGENTE: arrivo lo stesso giorno</span>}
      {presto && pu.prossimoCheckin && <span className="chip" style={{ background: '#FFB23822', color: '#C97A16' }}>prossimo arrivo {dataIt(pu.prossimoCheckin)}</span>}
      {pu.pagata && <span className="chip" style={{ background: '#1FAA6E22', color: '#1FAA6E' }}>pagata{pu.importo ? ` · ${eur(Number(pu.importo))}` : ''}</span>}

      {puoGestire && (
        <div style={{ flexBasis: '100%', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {gestisce && operatori.length > 0 && (
            <select defaultValue={pu.addettoId ?? ''} onChange={(e) => salva({ addettoId: e.target.value || null })} style={{ maxWidth: 160 }} aria-label="Addetto assegnato">
              <option value="">addetto: da assegnare</option>
              {operatori.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          )}
          {gestisce && <input type="time" value={ora} onChange={(e) => setOra(e.target.value)} onBlur={() => salva({ oraPrevista: ora })} aria-label="Orario" style={{ width: 110 }} />}
          {!gestisce && pu.oraPrevista && <small className="sub">ore {pu.oraPrevista}</small>}
          <input value={nota} onChange={(e) => setNota(e.target.value)} onBlur={() => nota !== (pu.note ?? '') && salva({ note: nota })} placeholder="note" style={{ flex: '1 1 160px' }} aria-label="Note" />
        </div>
      )}

      {puoGestire && checklist.length > 0 && !ancoraNo && (
        <div style={{ flexBasis: '100%', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {checklist.map((v) => (
            <label key={v} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={spunte.includes(v)} onChange={() => spunta(v)} style={{ width: 'auto' }} />{v}
            </label>
          ))}
        </div>
      )}

      {puoGestire && (
        <span className="azioni">
          <BottoneFatto
            disabilitato={ancoraNo} motivo={`da fare dal giorno del check-out (${dataIt(pu.data)})`}
            messaggioExtra={mancano.length ? `Mancano ${mancano.length} voci della checklist: confermi lo stesso?` : undefined}
            conferma={async () => { await api('conferma-pulizia', { id: pu.id, dati: { checklistFatta: spunte } }); }}
            annulla={async () => { await api('annulla-pulizia', { id: pu.id }); }}
            finito={onCambiato} />
          {ruolo === 'Titolare' && pu.origine !== 'Foglio' && <button className="danger" onClick={async () => { if (confirm('Eliminare questa pulizia?')) { await api('elimina-pulizia', { id: pu.id }); await onCambiato(); } }}>elimina</button>}
        </span>
      )}
      {errore && <small className="err" style={{ flexBasis: '100%' }}>{errore}</small>}
    </div>
  );
}
