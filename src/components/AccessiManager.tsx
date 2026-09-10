'use client';

import { useEffect, useState } from 'react';

// Pannello per gestire chi può accedere al sito prenotazioni condiviso (salzillo-hospitality,
// la pagina pubblica dove lo staff registra/cancella prenotazioni). Costruito il 09/09/2026
// dopo aver scoperto che quelle API non avevano NESSUN controllo di accesso — vedi
// src/lib/accessi.ts per il disegno completo del sistema.
//
// Solo Raffaele arriva qui (dentro Motore Rafilu, dietro la stessa chiave di tutta la
// dashboard) — questo pannello NON è il login dei collaboratori, è dove Raffaele crea e
// gestisce i loro account.

type Accesso = {
  row: number;
  username: string;
  nome: string;
  ruolo: string;
  puoCreare: boolean;
  puoCancellare: boolean;
  puoVedereFinanziario: boolean;
  attivo: boolean;
  creatoIl: string;
};

type FormState = {
  nome: string;
  ruolo: string;
  puoCreare: boolean;
  puoCancellare: boolean;
  puoVedereFinanziario: boolean;
};
const FORM_VUOTO: FormState = { nome: '', ruolo: '', puoCreare: true, puoCancellare: false, puoVedereFinanziario: false };

function suggerisciUsername(nome: string, esistenti: Accesso[]): string {
  const base = nome.trim().split(/\s+/)[0]?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? '';
  if (!base) return '';
  if (!esistenti.some((a) => a.username === base)) return base;
  const cognomeIniziale = nome.trim().split(/\s+/)[1]?.[0]?.toLowerCase() ?? '';
  const conIniziale = base + cognomeIniziale;
  if (cognomeIniziale && !esistenti.some((a) => a.username === conIniziale)) return conIniziale;
  let i = 2;
  while (esistenti.some((a) => a.username === `${base}${i}`)) i++;
  return `${base}${i}`;
}

export default function AccessiManager({ plancKey }: { plancKey: string }) {
  const [accessi, setAccessi] = useState<Accesso[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(FORM_VUOTO);
  const [salvando, setSalvando] = useState(false);
  const [erroreForm, setErroreForm] = useState<string | null>(null);
  const [nuovaPassword, setNuovaPassword] = useState<{ username: string; password: string } | null>(null);

  function carica() {
    setErrore(null);
    fetch('/api/admin/accessi', { headers: { 'x-plancia-key': plancKey } })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) setAccessi(d.accessi);
        else setErrore(d?.error || 'Errore sconosciuto nel caricamento.');
      })
      .catch((e) => setErrore(String(e)));
  }

  useEffect(() => { carica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErroreForm(null);
    if (!form.nome.trim()) { setErroreForm('Il nome è obbligatorio.'); return; }

    const username = suggerisciUsername(form.nome, accessi ?? []);
    setSalvando(true);
    try {
      const res = await fetch('/api/admin/accessi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-plancia-key': plancKey },
        body: JSON.stringify({ ...form, username, nome: form.nome.trim(), ruolo: form.ruolo.trim() }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d?.error || 'Errore sconosciuto nella creazione');
      setNuovaPassword({ username: d.username, password: d.password });
      setForm(FORM_VUOTO);
      carica();
    } catch (err) {
      setErroreForm(err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  async function resetPassword(username: string) {
    if (!confirm(`Generare una nuova password per "${username}"? Quella vecchia smetterà subito di funzionare.`)) return;
    const res = await fetch('/api/admin/accessi', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-plancia-key': plancKey },
      body: JSON.stringify({ username, azione: 'reset' }),
    });
    const d = await res.json();
    if (d.ok) setNuovaPassword({ username, password: d.password });
    else alert(d?.error || 'Errore nel reset');
  }

  async function toggleAttivo(a: Accesso) {
    const azione = a.attivo ? 'disattiva' : 'attiva';
    const res = await fetch('/api/admin/accessi', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-plancia-key': plancKey },
      body: JSON.stringify({ username: a.username, azione }),
    });
    const d = await res.json();
    if (d.ok) carica();
    else alert(d?.error || 'Errore');
  }

  return (
    <div className="detail-grid">
      <div className="panel">

        {nuovaPassword && (
          <div className="card row static" style={{ borderColor: 'var(--good, #1FAA6E)' }}>
            <div className="card-title"><span className="t">Credenziali per {nuovaPassword.username}</span></div>
            <p style={{ margin: '.2rem 0 .6rem', color: 'var(--ink-muted)', fontSize: '.85rem' }}>
              Mostrate una volta sola — comunicale ora al collaboratore (WhatsApp, di persona...). Dopo questo momento non saranno più recuperabili: solo un nuovo reset.
            </p>
            <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', fontFamily: 'monospace', fontSize: '1rem' }}>
              <span><b style={{ color: 'var(--ink-faint)', fontFamily: 'inherit', fontSize: '.75rem', display: 'block' }}>Username</b>{nuovaPassword.username}</span>
              <span><b style={{ color: 'var(--ink-faint)', fontFamily: 'inherit', fontSize: '.75rem', display: 'block' }}>Password</b>{nuovaPassword.password}</span>
            </div>
            <button
              type="button"
              className="badge good"
              style={{ border: 'none', cursor: 'pointer', padding: '.45rem .9rem', fontSize: '.8rem', marginTop: '.8rem' }}
              onClick={() => setNuovaPassword(null)}
            >
              Ho salvato, chiudi
            </button>
          </div>
        )}

        <div className="card row static">
          <div className="card-title"><span className="t">Collaboratori con accesso al sito prenotazioni</span></div>

          {errore && <p style={{ color: 'var(--warn-ink, #a15c00)' }}>Non riesco a leggere gli accessi ({errore}).</p>}
          {!errore && accessi === null && <p style={{ color: 'var(--ink-muted)' }}>Caricamento…</p>}
          {!errore && accessi !== null && accessi.length === 0 && (
            <p style={{ color: 'var(--ink-muted)' }}>Nessun accesso creato ancora — solo tu vedi/gestisci il sito prenotazioni finché non ne crei uno qui sotto.</p>
          )}

          {!errore && accessi !== null && accessi.length > 0 && (
            <ul className="mini-list" style={{ marginTop: '.6rem' }}>
              {accessi.map((a) => (
                <li key={a.username} style={{ opacity: a.attivo ? 1 : 0.5 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '.15rem' }}>
                    <span style={{ fontWeight: 700 }}>{a.nome} <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>@{a.username}</span></span>
                    <span style={{ fontSize: '.75rem', color: 'var(--ink-faint)' }}>
                      {[a.puoCreare && 'crea', a.puoCancellare && 'cancella', a.puoVedereFinanziario && 'vede finanziario'].filter(Boolean).join(' · ') || 'sola visualizzazione'}
                      {!a.attivo && ' · disattivato'}
                    </span>
                  </span>
                  <span style={{ display: 'flex', gap: '.4rem' }}>
                    <button type="button" onClick={() => resetPassword(a.username)} className="badge neutral" style={{ border: 'none', cursor: 'pointer', fontSize: '.72rem', padding: '.35rem .7rem' }}>
                      Reset password
                    </button>
                    <button type="button" onClick={() => toggleAttivo(a)} className={a.attivo ? 'badge warn' : 'badge good'} style={{ border: 'none', cursor: 'pointer', fontSize: '.72rem', padding: '.35rem .7rem' }}>
                      {a.attivo ? 'Disattiva' : 'Riattiva'}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card row static">
          <form onSubmit={handleSubmit}>
            <h4 style={{ fontSize: '.88rem', margin: '0 0 .8rem', fontWeight: 700 }}>Crea un nuovo accesso</h4>
            <div style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)', flex: '0 0 180px' }}>
                Nome e cognome
                <input
                  type="text"
                  placeholder="Es: Lella Salzillo"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  style={{ fontSize: '.88rem', padding: '.45rem .6rem', borderRadius: '.5rem', border: '1px solid var(--ink-faint)', background: 'var(--surface)' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', fontSize: '.78rem', color: 'var(--ink-muted)', flex: '0 0 150px' }}>
                Ruolo (facoltativo)
                <input
                  type="text"
                  placeholder="Es: Collaboratrice"
                  value={form.ruolo}
                  onChange={(e) => setForm((f) => ({ ...f, ruolo: e.target.value }))}
                  style={{ fontSize: '.88rem', padding: '.45rem .6rem', borderRadius: '.5rem', border: '1px solid var(--ink-faint)', background: 'var(--surface)' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '.9rem', fontSize: '.82rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                <input type="checkbox" checked={form.puoCreare} onChange={(e) => setForm((f) => ({ ...f, puoCreare: e.target.checked }))} />
                Può creare prenotazioni
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                <input type="checkbox" checked={form.puoCancellare} onChange={(e) => setForm((f) => ({ ...f, puoCancellare: e.target.checked }))} />
                Può cancellarle
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                <input type="checkbox" checked={form.puoVedereFinanziario} onChange={(e) => setForm((f) => ({ ...f, puoVedereFinanziario: e.target.checked }))} />
                Vede dati finanziari (lordo/utile)
              </label>
            </div>
            <button
              type="submit"
              className="badge good"
              style={{ border: 'none', cursor: salvando ? 'wait' : 'pointer', padding: '.55rem 1rem', fontSize: '.82rem', minHeight: '2.5rem', marginTop: '1rem' }}
              disabled={salvando}
            >
              {salvando ? 'Creo…' : 'Crea accesso'}
            </button>
            {erroreForm && <p style={{ color: 'var(--urgent, #d5473c)', fontSize: '.8rem', marginTop: '.6rem' }}>{erroreForm}</p>}
          </form>
          <p style={{ color: 'var(--ink-faint)', fontSize: '.8rem', marginTop: '1rem' }}>
            Username e password vengono generati automaticamente — la password è mostrata una sola volta, subito dopo la creazione. Il collaboratore non può cambiarla da solo: solo tu puoi resettarla da qui.
          </p>
        </div>

      </div>
    </div>
  );
}
