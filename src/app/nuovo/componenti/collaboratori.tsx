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
  const [invito, setInvito] = useState<{ nome: string; codice: string } | null>(null);
  const [espanso, setEspanso] = useState<string | null>(null);
  const tuttiImmobili = anagrafica.flatMap((p) => p.immobili.map((im) => ({ ...im, proprietario: p.nome })));

  async function crea() {
    if (!nuovo?.nome.trim()) return;
    setBusy(true);
    try {
      const r = await api('invita-collaboratore', { dati: { nome: nuovo.nome.trim(), ruolo: nuovo.ruolo } });
      setInvito({ nome: nuovo.nome.trim(), codice: (r as { codice_invito: string }).codice_invito });
      setNuovo(null); await onCambiato();
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="cardhead">
        <h2>Chi ha accesso al sistema <small>({utenti.length})</small></h2>
        <button className="add" onClick={() => setNuovo({ nome: '', ruolo: 'Collaboratore' })}>＋ Persona</button>
      </div>
      <p className="sub">Tu crei la scheda (nome e ruolo), la persona sceglie DA SÉ username e password al primo accesso, usando il codice che le dai tu.</p>
      {invito && (
        <div className="form" style={{ padding: 12, background: 'var(--coral-soft)', borderRadius: 10, marginBottom: 10 }}>
          <b>Codice invito per {invito.nome}: <span style={{ fontSize: 20, letterSpacing: 2 }}>{invito.codice}</span></b>
          <p className="sub">Daglielo di persona o a voce. La persona deve andare su <b>salzillo-hospitality.vercel.app/nuovo</b>, cliccare &quot;Primo accesso&quot; sotto al modulo di login, inserire questo codice e scegliere da sé username e password.</p>
          <button onClick={() => setInvito(null)}>Ho capito</button>
        </div>
      )}
      {nuovo && (
        <div className="form" style={{ marginBottom: 10 }}>
          <label>Nome<input value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} autoFocus /></label>
          <label>Ruolo<select value={nuovo.ruolo} onChange={(e) => setNuovo({ ...nuovo, ruolo: e.target.value })}>
            {['Collaboratore', 'Pulizie', 'Proprietario'].map((r) => <option key={r}>{r}</option>)}
          </select></label>
          <div className="modalactions">
            <button className="add" onClick={crea} disabled={busy || !nuovo.nome.trim()}>{busy ? '…' : 'Crea e genera codice'}</button>
            <button onClick={() => setNuovo(null)}>Annulla</button>
          </div>
        </div>
      )}
      {utenti.map((u) => (
        <div key={u.id} className="docrow" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill pill-Bozza">{u.ruolo}</span>
            <b>{u.nome}</b>
            {u.username ? <span className="empty">@{u.username}</span> : u.codiceInvito ? <span className="empty">invito in attesa: <b>{u.codiceInvito}</b></span> : null}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
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
