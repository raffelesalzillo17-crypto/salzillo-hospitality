'use client';

import { useState } from 'react';
import type { Alloggio, Ospite } from '../tipi';
import { api, dataIt, eur } from '../utilita';

export function FormPreventivo({ alloggi, ospiti, onClose, onSalvato }: { alloggi: Alloggio[]; ospiti: Ospite[]; onClose: () => void; onSalvato: () => Promise<void> }) {
  const [f, setF] = useState({ alloggioId: alloggi[0]?.id ?? '', ospiteId: '', checkin: '', checkout: '', ospiti: '2', prezzoNotte: '', prezzo: '', sconto: '', scontoTipo: 'euro', cliente: '', tel: '', ore: '24', note: '' });
  const [vediAnteprima, setVediAnteprima] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function scegliOspite(id: string) {
    const o = ospiti.find((x) => x.id === id);
    setF((s) => ({ ...s, ospiteId: id, cliente: o ? `${o.nome} ${o.cognome}`.trim() : s.cliente, tel: o?.telefono ?? s.tel }));
  }

  const nnotti = f.checkin && f.checkout ? Math.max(0, Math.round((Date.parse(f.checkout) - Date.parse(f.checkin)) / 864e5)) : 0;
  // quando cambia il prezzo/notte o le date, ricalcola il totale; e viceversa
  function setNotte(v: string) {
    const tot = v && nnotti ? (Number(v) * nnotti).toFixed(2) : '';
    setF((s) => ({ ...s, prezzoNotte: v, prezzo: tot }));
  }
  function setTotale(v: string) {
    const pn = v && nnotti ? (Number(v) / nnotti).toFixed(2) : '';
    setF((s) => ({ ...s, prezzo: v, prezzoNotte: pn }));
  }

  const totLordo = f.prezzo ? Number(f.prezzo) : (f.prezzoNotte && nnotti ? Number(f.prezzoNotte) * nnotti : 0);
  const scontoNum = Number(f.sconto) || 0;
  const scontoEuro = scontoNum > 0 ? (f.scontoTipo === 'percento' ? Math.round(totLordo * scontoNum) / 100 : scontoNum) : 0;
  const totFinale = Math.max(0, Math.round((totLordo - scontoEuro) * 100) / 100);

  const q = new URLSearchParams({
    tipo: 'preventivo', alloggio: f.alloggioId, checkin: f.checkin, checkout: f.checkout,
    ospiti: f.ospiti, cliente: f.cliente, tel: f.tel, ore: f.ore || '24', note: f.note,
    ...(f.prezzoNotte ? { prezzoNotte: f.prezzoNotte } : {}), ...(f.prezzo ? { prezzo: f.prezzo } : {}),
    ...(scontoNum > 0 ? { sconto: f.sconto, scontoTipo: f.scontoTipo } : {}),
  });
  const url = `/api/nuovo/documento?${q.toString()}`;
  const pronto = f.alloggioId && f.checkin && f.checkout && nnotti > 0 && (f.prezzo || f.prezzoNotte);

  const nomeAlloggio = alloggi.find((a) => a.id === f.alloggioId)?.nome ?? '';
  const telPulito = f.tel.replace(/[^\d]/g, '');
  const saluto = new Date().getHours() < 14 ? 'Buongiorno' : 'Buonasera';
  const primoNome = f.cliente ? f.cliente.trim().split(/\s+/)[0] : '';
  // WhatsApp (link wa.me gratuito) non permette di allegare un file: l'unico modo di far
  // arrivare il PDF insieme al messaggio è mettere il link diretto nel testo — l'ospite lo apre
  // con un tap, Raffaele non deve allegare nulla a mano. Un vero allegato nativo richiederebbe
  // le API Business di WhatsApp (a pagamento, verifica aziendale Meta) — vedi
  // wiki/decisioni/infrastruttura-free-first.md.
  function buildMsgWa(pdfUrl?: string) {
    return [
      `${saluto}${primoNome ? ' ' + primoNome : ''}, sono Raffaele di Salzillo Hospitality.`,
      `Ecco il preventivo per ${nomeAlloggio}:`,
      `Check-in ${f.checkin ? dataIt(f.checkin) : '—'} · Check-out ${f.checkout ? dataIt(f.checkout) : '—'} (${nnotti} notti, ${f.ospiti} ospiti)`,
      `Totale ${eur(totFinale)}${scontoEuro > 0 ? ` (sconto −${eur(scontoEuro)})` : ''}`,
      `Per bloccare le date puoi confermare entro ${f.ore || '24'} ore: fino ad allora l'alloggio resta riservato a te, dopodiché torna disponibile.`,
      `Cancellazione gratuita fino a 48h prima del check-in.`,
      pdfUrl ? `Qui il PDF con tutti i dettagli: ${pdfUrl}` : `Ti mando il PDF con tutti i dettagli a parte.`,
      `Per qualsiasi dubbio scrivimi pure qui.`,
    ].join('\n');
  }
  const waUrl = `https://wa.me/${telPulito.length >= 9 ? (telPulito.length === 10 ? '39' + telPulito : telPulito) : ''}?text=${encodeURIComponent(buildMsgWa())}`;

  const [salvato, setSalvato] = useState<{ waUrl: string } | null>(null);
  const chiudi = () => { if (salvato) void onSalvato(); else onClose(); };

  async function salva() {
    setBusy(true); setErr('');
    try {
      const [nome, ...resto] = f.cliente.trim().split(/\s+/);
      const creato = await api('crea-preventivo', { dati: {
        alloggioId: f.alloggioId, checkin: f.checkin, checkout: f.checkout, numeroOspiti: Number(f.ospiti) || 1,
        ...(f.prezzo ? { prezzo: Number(f.prezzo) } : {}), ...(f.prezzoNotte ? { prezzoNotte: Number(f.prezzoNotte) } : {}),
        ...(scontoNum > 0 ? { sconto: scontoNum, scontoTipo: f.scontoTipo } : {}),
        validoOre: Number(f.ore) || 24, note: f.note || undefined,
        ...(f.ospiteId ? { ospiteId: f.ospiteId } : { ospiteNome: nome || undefined, ospiteCognome: resto.join(' ') || undefined, ospiteTelefono: f.tel || undefined }),
      } }) as { id: string };
      // Appena salvato mostro un pulsante "Apri WhatsApp" (un link vero, cliccato da te: non può essere
      // bloccato). Il tentativo precedente di aprire una scheda vuota PRIMA del salvataggio e
      // reindirizzarla DOPO lasciava una pagina bianca (about:blank) — segnalato il 13/09/2026
      // anche dopo il tentativo di correzione del 22/09. Resta un tap manuale per "Invia" dentro
      // WhatsApp: l'invio senza tocchi richiede le API Business, non il link wa.me gratuito.
      if (telPulito.length >= 9) {
        const pdfUrl = `${window.location.origin}/api/nuovo/documento?tipo=preventivo&id=${creato.id}`;
        setSalvato({ waUrl: `https://wa.me/${telPulito.length === 10 ? '39' + telPulito : telPulito}?text=${encodeURIComponent(buildMsgWa(pdfUrl))}` });
        setBusy(false);
        return;
      }
      await onSalvato();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e)); setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={chiudi}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={chiudi}>✕</button>
        <h2>Preventivo</h2>
        <div className="form">
          <label>Alloggio<select value={f.alloggioId} onChange={(e) => setF({ ...f, alloggioId: e.target.value })}>{alloggi.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
          <label>Ospite<select value={f.ospiteId} onChange={(e) => scegliOspite(e.target.value)}>
            <option value="">— nuovo, scrivo sotto —</option>
            {ospiti.map((o) => <option key={o.id} value={o.id}>{o.cognome} {o.nome}</option>)}
          </select></label>
          <label>Check-in<input type="date" value={f.checkin} onChange={(e) => setF({ ...f, checkin: e.target.value })} /></label>
          <label>Check-out<input type="date" value={f.checkout} onChange={(e) => setF({ ...f, checkout: e.target.value })} /></label>
          {nnotti > 0 && <p className="sub">= {nnotti} notti</p>}
          <label>Ospiti<input type="number" min="1" value={f.ospiti} onChange={(e) => setF({ ...f, ospiti: e.target.value })} /></label>
          <label>Prezzo a notte €<input type="number" step="0.01" value={f.prezzoNotte} onChange={(e) => setNotte(e.target.value)} /></label>
          <label>Prezzo totale € <span style={{ fontWeight: 400 }}>(o compila questo)</span><input type="number" step="0.01" value={f.prezzo} onChange={(e) => setTotale(e.target.value)} /></label>
          <label>Sconto <span style={{ fontWeight: 400 }}>(facoltativo)</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="number" step="0.01" min="0" value={f.sconto} onChange={(e) => setF({ ...f, sconto: e.target.value })} style={{ flex: 1 }} />
              <select value={f.scontoTipo} onChange={(e) => setF({ ...f, scontoTipo: e.target.value })} style={{ width: 64 }}>
                <option value="euro">€</option>
                <option value="percento">%</option>
              </select>
            </div>
          </label>
          {totLordo > 0 && <p className="sub">{scontoEuro > 0 ? `Totale scontato: ${eur(totFinale)}  (sconto −${eur(scontoEuro)})` : `Totale: ${eur(totFinale)}`}</p>}
          <label>Nome cliente<input value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} /></label>
          <label>Telefono cliente <span style={{ fontWeight: 400 }}>(per WhatsApp)</span><input type="tel" inputMode="tel" placeholder="es. 333 1234567" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></label>
          <label>Ore per confermare <span style={{ fontWeight: 400 }}>(blocco alloggio)</span><input type="number" min="1" value={f.ore} onChange={(e) => setF({ ...f, ore: e.target.value })} /></label>
          <label>Note<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        </div>
        {pronto && vediAnteprima && (
          <div style={{ marginTop: 12 }}>
            <iframe src={url} title="Anteprima preventivo" style={{ width: '100%', height: 460, border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }} />
            <p className="empty" style={{ marginTop: 4 }}>È quello che vedrà l&apos;ospite. Il PDF resta salvato: puoi ri-aprirlo quando vuoi.</p>
          </div>
        )}
        {err && <p className="err">{err}</p>}
        {salvato && (
          <div style={{ margin: '12px 0', padding: 12, border: '1px solid #1FAA6E55', borderRadius: 10, background: '#1FAA6E11' }}>
            <b>✅ Preventivo salvato nei documenti.</b>
            <p className="empty" style={{ margin: '4px 0 10px' }}>Premi qui sotto: si apre WhatsApp col messaggio già scritto e il link al PDF dentro, ti resta solo da premere Invia.</p>
            <a className="add" href={salvato.waUrl} target="_blank" rel="noopener" style={{ textDecoration: 'none', display: 'inline-block' }}>💬 Apri WhatsApp</a>
            <button style={{ marginLeft: 8 }} onClick={() => void onSalvato()}>Fine</button>
          </div>
        )}
        {!salvato && <div className="modalactions">
          {pronto
            ? <button className="add" onClick={() => setVediAnteprima((v) => !v)}>{vediAnteprima ? 'Nascondi anteprima' : '👁 Anteprima'}</button>
            : <button className="add" disabled>Compila i campi</button>}
          {pronto && <button className="add" onClick={salva} disabled={busy}>{busy ? 'salvo…' : telPulito.length >= 9 ? '💾 Salva e prepara WhatsApp' : '💾 Salva nei documenti'}</button>}
          {pronto && telPulito.length >= 9 && <a className="sync" href={waUrl} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>💬 Riapri WhatsApp</a>}
          <button onClick={onClose}>Chiudi</button>
        </div>}
        {pronto && (
          <p className="empty" style={{ marginTop: 6 }}>
            {telPulito.length >= 9
              ? 'Salvando compare il pulsante per aprire WhatsApp col messaggio già scritto e il link al PDF già dentro: ti resta solo da premere Invia. Lo trovi anche dopo nella scheda Documenti.'
              : 'Salvando lo trovi nella scheda Documenti, con anteprima e "segna accettato". Aggiungi il telefono per aprire WhatsApp in automatico.'}
          </p>
        )}
      </div>
    </div>
  );
}
