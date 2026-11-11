'use client';

import { useState } from 'react';
import type { Anagrafica, Permesso, UtenteAdmin } from '../tipi';
import { api } from '../utilita';

// ── Collaboratori (accessi al sistema) ────────────────────────────────────────
export function CollaboratoriBox({ utenti, anagrafica, permessi, onCambiato }: {
  utenti: UtenteAdmin[]; anagrafica: Anagrafica; permessi: Permesso[]; onCambiato: () => Promise<void>;
}) {
  const [nuovo, setNuovo] = useState<{ nome: string; ruolo: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [invito, setInvito] = useState<{ nome: string; url: string; copiato: boolean } | null>(null);
  const [espanso, setEspanso] = useState<string | null>(null);
  const tuttiImmobili = anagrafica.flatMap((p) => p.immobili.map((im) => ({ ...im, proprietario: p.nome })));

  async function crea() {
    if (!nuovo?.nome.trim()) return;
    setBusy(true);
    try {
      const r = await api('invita-collaboratore', { dati: { nome: nuovo.nome.trim(), ruolo: nuovo.ruolo } }) as { id: string };
      const nome = nuovo.nome.trim();
      setNuovo(null); await onCambiato();
      await mostraLink(r.id, nome, false);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  // Il link personale di una persona: lo chiede al server (che lo crea se manca, o lo cambia
  // con rigenera), prova a copiarlo e lo mostra comunque, così si può copiare a mano.
  async function mostraLink(id: string, nome: string, rigenera: boolean) {
    try {
      const r = await api('link-accesso', { id, dati: { rigenera } }) as { chiave: string };
      const url = `${window.location.origin}/entra?k=${r.chiave}`;
      let copiato = false;
      try { await navigator.clipboard.writeText(url); copiato = true; } catch { /* si copia a mano dal riquadro */ }
      setInvito({ nome, url, copiato });
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="cardhead">
        <h2>Chi ha accesso al sistema <small>({utenti.length})</small></h2>
        <button className="add" onClick={() => setNuovo({ nome: '', ruolo: 'Collaboratore' })}>＋ Persona</button>
      </div>
      <p className="sub">Tu crei la scheda (nome e ruolo) e il sistema genera un link solo per quella persona: aprendolo entra, senza username né password. Chi ha il link entra come lei.</p>
      {invito && (
        <div className="form" style={{ padding: 12, background: 'var(--coral-soft)', borderRadius: 10, marginBottom: 10 }}>
          <b>Link personale di {invito.nome}{invito.copiato ? ' — copiato ✓' : ''}</b>
          <input readOnly value={invito.url} onFocus={(e) => e.target.select()} style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }} />
          <p className="sub">Mandalo solo a {invito.nome} (WhatsApp va bene). Aprendolo trova il pulsante per entrare e le istruzioni per mettere l&apos;app sul telefono; basta farlo una volta su ogni dispositivo, poi resta dentro. Per toglierle l&apos;accesso usa &quot;disattiva&quot;, oppure &quot;nuovo link&quot; se il link è finito in mani sbagliate.</p>
          <button onClick={() => setInvito(null)}>Chiudi</button>
        </div>
      )}
      {nuovo && (
        <div className="form" style={{ marginBottom: 10 }}>
          <label>Nome<input value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} autoFocus /></label>
          <label>Ruolo<select value={nuovo.ruolo} onChange={(e) => setNuovo({ ...nuovo, ruolo: e.target.value })}>
            {['Collaboratore', 'Pulizie', 'Proprietario'].map((r) => <option key={r}>{r}</option>)}
          </select></label>
          <div className="modalactions">
            <button className="add" onClick={crea} disabled={busy || !nuovo.nome.trim()}>{busy ? '…' : 'Crea e genera il link'}</button>
            <button onClick={() => setNuovo(null)}>Annulla</button>
          </div>
        </div>
      )}
      {utenti.map((u) => (
        <div key={u.id} className="docrow" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill pill-Bozza">{u.ruolo}</span>
            <b>{u.nome}</b>
            {!u.attivo && <span className="empty">disattivato</span>}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="mini" onClick={() => mostraLink(u.id, u.nome, false)} title="Mostra e copia il link personale di questa persona">🔗 link</button>
              <button className="mini" title="Genera un link nuovo: quello vecchio smette di funzionare" onClick={() => {
                if (confirm(`Generare un link nuovo per ${u.nome}? Quello vecchio smette di funzionare: dovrai mandarle quello nuovo${u.ruolo === 'Titolare' ? ' (se sei tu, salvalo subito)' : ''}.`)) mostraLink(u.id, u.nome, true);
              }}>↻ nuovo link</button>
              {u.ruolo !== 'Titolare' && (u.ruolo === 'Collaboratore' || u.ruolo === 'Proprietario') && (
                <button className="linklike" onClick={() => setEspanso(espanso === u.id ? null : u.id)}>permessi</button>
              )}
              {u.ruolo !== 'Titolare' && (
                <button className="mini" onClick={async () => { await api('attiva-utente', { id: u.id, dati: { attivo: !u.attivo } }); await onCambiato(); }}>{u.attivo ? 'disattiva' : 'riattiva'}</button>
              )}
              {u.ruolo === 'Pulizie' && (
                <button className="mini" onClick={async () => {
                  if (!confirm(`Eliminare per sempre l'operatore "${u.nome}"? Funziona solo se non ha ancora nessuna pulizia agganciata (altrimenti usa "disattiva").`)) return;
                  try { await api('elimina-operatore-pulizie', { id: u.id }); await onCambiato(); }
                  catch (e) { alert(e instanceof Error ? e.message : String(e)); }
                }}>🗑️ elimina</button>
              )}
            </span>
          </div>
          {espanso === u.id && (
            <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid var(--line)' }}>
              {tuttiImmobili.map((im) => {
                const perm = permessi.find((p) => p.utente_id === u.id && p.immobile_id === im.id);
                const set = async (patch: Partial<{ puoVedere: boolean; puoModificare: boolean; puoVedereFinanziario: boolean }>) => {
                  await api('imposta-permesso', { dati: {
                    utenteId: u.id, immobileId: im.id,
                    puoVedere: patch.puoVedere ?? perm?.puo_vedere ?? false,
                    puoModificare: patch.puoModificare ?? perm?.puo_modificare ?? false,
                    puoVedereFinanziario: patch.puoVedereFinanziario ?? perm?.puo_vedere_finanziario ?? false,
                  } });
                  await onCambiato();
                };
                return (
                  <label key={im.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '4px 0' }}>
                    <span style={{ minWidth: 140 }}>{im.nome}</span>
                    <span><input type="checkbox" checked={!!perm?.puo_vedere} onChange={(e) => set({ puoVedere: e.target.checked })} /> vede</span>
                    <span><input type="checkbox" checked={!!perm?.puo_modificare} onChange={(e) => set({ puoModificare: e.target.checked })} /> modifica</span>
                    <span><input type="checkbox" checked={!!perm?.puo_vedere_finanziario} onChange={(e) => set({ puoVedereFinanziario: e.target.checked })} /> vede €</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
