'use client';

import { useState, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type FormState = {
  checkin:  string;
  checkout: string;
  ospite:   string;
  telefono: string;
  stanza:   string;
  canale:   string;
  lordo:    string;
};

type SuccessData = FormState & { utile: number };

type Prenotazione = {
  row:      number;
  checkin:  string;
  checkout: string;
  ospite:   string;
  stanza:   string;
  canale:   string;
  lordo?:   number;
  utile?:   number;
  stato:    string;
  penale:   string;
  eventId:  string;
};

type CancelState = {
  pren:       Prenotazione;
  step:       'ask' | 'amount' | 'done';
  penaleType: 'nessuna' | 'penale' | null;
  importo:    string;
  msg:        string;
};

type Sessione = {
  nome: string;
  puoCreare: boolean;
  puoCancellare: boolean;
  puoVedereFinanziario: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

// Rinominate "Stanza 3/4/5" -> "Piano Terra/Primo Piano/Secondo Piano" su richiesta di
// Raffaele (08/09/2026) — eccezione approvata esplicitamente in chat alla regola "non toccare
// la funzionalità di questa route" (vedi wiki/decisioni/non-toccare-sito-prenotazioni.md),
// stesso spirito dell'eccezione per il campo Telefono del 07/09/2026.
const STANZE = ['Tulipano', 'Rosa', 'Piano Terra', 'Primo Piano', 'Secondo Piano'];
const CANALI = ['Airbnb', 'Booking', 'Diretto', 'No Tax'];

const EMPTY: FormState = {
  checkin: '', checkout: '', ospite: '', telefono: '', stanza: '', canale: '', lordo: '',
};

const BADGE: Record<string, React.CSSProperties> = {
  Airbnb:   { background: '#E8F0FE', color: '#1A56DB' },
  Booking:  { background: '#FEF3C7', color: '#92400E' },
  Diretto:  { background: '#D1FAE5', color: '#065F46' },
  'No Tax': { background: '#F5F0EA', color: '#6E6E73' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const FONT = "'Inter', sans-serif";
const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";
const CARD_SHADOW = '0 1px 2px rgba(28,20,15,.04), 0 10px 24px rgba(28,20,15,.06)';

function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function calcNights(c1: string, c2: string): number {
  if (!c1 || !c2) return 0;
  return Math.round((new Date(c2).getTime() - new Date(c1).getTime()) / 86_400_000);
}

function parseDateIT(s: string): Date | null {
  if (!s) return null;
  const p = s.split('/');
  if (p.length !== 3) return null;
  return new Date(`${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`);
}

function calcNightsIT(ci: string, co: string): number {
  const d1 = parseDateIT(ci);
  const d2 = parseDateIT(co);
  if (!d1 || !d2) return 0;
  return Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
}

function isFuture(checkout: string): boolean {
  const co = parseDateIT(checkout);
  if (!co) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return co >= today;
}

function buildWhatsApp(d: SuccessData): string {
  const n = calcNights(d.checkin, d.checkout);
  return [
    '🏠 NUOVA PRENOTAZIONE',
    '━━━━━━━━━━━━━━━━',
    `🛏 Stanza: ${d.stanza}`,
    `👤 Ospite: ${d.ospite}`,
    `📅 ${fmtDate(d.checkin)} → ${fmtDate(d.checkout)} (${n} nott${n === 1 ? 'e' : 'i'})`,
    `📲 Canale: ${d.canale}`,
    `💶 Lordo: €${d.lordo}`,
    `✅ Utile reale: €${d.utile}`,
    '━━━━━━━━━━━━━━━━',
  ].join('\n');
}

function buildCancelWhatsApp(p: Prenotazione, tipo: 'nessuna' | 'penale', importo: string): string {
  const n = calcNightsIT(p.checkin, p.checkout);
  return [
    '❌ CANCELLAZIONE PRENOTAZIONE',
    '━━━━━━━━━━━━━━━━',
    `🛏 Stanza: ${p.stanza}`,
    `👤 Ospite: ${p.ospite}`,
    `📅 ${p.checkin} → ${p.checkout} (${n} nott${n === 1 ? 'e' : 'i'})`,
    `📲 Canale: ${p.canale}`,
    `💸 Penale: ${tipo === 'penale' ? `€${importo}` : 'Nessuna penale'}`,
    '━━━━━━━━━━━━━━━━',
  ].join('\n');
}

// ── Styles ────────────────────────────────────────────────────────────────────

const css = {
  page: {
    background: '#FAF7F3',
    minHeight: '100vh',
    padding: '28px 16px 48px',
    fontFamily: FONT,
  } as React.CSSProperties,

  wrap: {
    maxWidth: 480,
    margin: '0 auto',
  } as React.CSSProperties,

  card: {
    background: '#FFFFFF',
    border: '1.5px solid #EFEAE3',
    borderRadius: 20,
    padding: '24px 20px',
    boxShadow: CARD_SHADOW,
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: '#1C1C1E',
    marginBottom: 6,
    fontFamily: FONT,
  } as React.CSSProperties,

  input: {
    display: 'block',
    width: '100%',
    padding: '12px 14px',
    fontSize: 16,
    color: '#1C1C1E',
    background: '#FAF7F3',
    border: '1.5px solid #EFEAE3',
    borderRadius: 10,
    fontFamily: FONT,
    boxSizing: 'border-box' as const,
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
    outline: 'none',
  } as React.CSSProperties,

  btnDark: {
    display: 'block',
    width: '100%',
    height: 52,
    background: '#FF5A5F',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    fontFamily: FONT_DISPLAY,
    cursor: 'pointer',
    letterSpacing: '0.01em',
    transition: 'background 0.15s',
  } as React.CSSProperties,

  btnTeal: {
    display: 'block',
    width: '100%',
    height: 52,
    background: '#1FAA6E',
    color: '#ffffff',
    border: 'none',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 600,
    fontFamily: FONT,
    cursor: 'pointer',
    transition: 'background 0.15s',
  } as React.CSSProperties,

  btnOutline: {
    display: 'block',
    width: '100%',
    height: 52,
    background: '#FFFFFF',
    color: '#1C1C1E',
    border: '1.5px solid #EFEAE3',
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 600,
    fontFamily: FONT,
    cursor: 'pointer',
    transition: 'background 0.15s',
  } as React.CSSProperties,

  btnRed: {
    background: '#E5484D',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: FONT,
    cursor: 'pointer',
    padding: '7px 14px',
    transition: 'background 0.15s',
  } as React.CSSProperties,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, last, children }: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: last ? 24 : 16 }}>
      <label style={css.label}>{label}</label>
      {children}
    </div>
  );
}

function BadgeCanale({ canale }: { canale: string }) {
  const style = BADGE[canale] ?? { background: '#F5F0EA', color: '#6E6E73' };
  return (
    <span style={{
      ...style,
      fontSize: 11,
      fontWeight: 600,
      padding: '3px 8px',
      borderRadius: 6,
      letterSpacing: '0.03em',
      fontFamily: FONT,
    }}>
      {canale}
    </span>
  );
}

function Logo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Salzillo Hospitality"
        style={{ height: 60, display: 'block', margin: '0 auto 10px' }}
      />
      <h1 style={{
        fontSize: 15,
        fontWeight: 300,
        color: '#1C1C1E',
        margin: 0,
        fontFamily: FONT,
        letterSpacing: '3px',
        textTransform: 'uppercase',
      }}>
        SALZILLO HOSPITALITY
      </h1>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  // Login RIMOSSO il 10/09/2026 su richiesta esplicita di Raffaele: "fin quando il nuovo
  // database non sarà pronto voglio continuare a usare il mio sistema iniziale senza
  // password, senza login". Il sito torna com'era prima del 09/09 — chiunque abbia l'URL
  // può vedere/creare/cancellare prenotazioni. La sicurezza vera tornerà nel nuovo sistema
  // (utenti/ruoli/ambiti per-immobile) — vedi wiki/sintesi/piano-migrazione-database-modello-proprietario.md.
  // Il codice degli accessi (src/lib/accessi.ts, /api/login|logout|me, AccessiManager) resta
  // nel repo come base di partenza per quel lavoro, ma non è più collegato a niente qui.
  const sessione: Sessione = { nome: '', puoCreare: true, puoCancellare: true, puoVedereFinanziario: true };

  // Form
  const [form, setForm]       = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [copied, setCopied]   = useState(false);

  // Prenotazioni list
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [loadingPren, setLoadingPren]   = useState(true);
  const [errorPren, setErrorPren]       = useState<string | null>(null);
  const [showStorico, setShowStorico]   = useState(false);

  // Cancellazione
  const [cancelState, setCancelState]     = useState<CancelState | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelCopied, setCancelCopied]   = useState(false);

  async function loadPrenotazioni() {
    setLoadingPren(true);
    setErrorPren(null);
    try {
      const res  = await fetch('/api/prenotazioni');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore caricamento');
      setPrenotazioni(data.prenotazioni ?? []);
    } catch (err) {
      setErrorPren(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoadingPren(false);
    }
  }

  useEffect(() => { loadPrenotazioni(); }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/prenotazione', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, lordo: Number(form.lordo) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore nel salvataggio');
      setSuccess({ ...form, utile: data.utile });
      loadPrenotazioni();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }

  async function onCopy() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(buildWhatsApp(success));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard non disponibile */ }
  }

  function onReset() {
    setForm(EMPTY);
    setSuccess(null);
    setError(null);
    setCopied(false);
  }

  function startCancella(pren: Prenotazione) {
    setCancelState({ pren, step: 'ask', penaleType: null, importo: '', msg: '' });
    setCancelCopied(false);
  }

  async function confirmCancella(tipo: 'nessuna' | 'penale', importo: string) {
    if (!cancelState) return;
    setCancelLoading(true);
    try {
      const res = await fetch('/api/cancella', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          row:          cancelState.pren.row,
          penaleType:   tipo,
          importoPenale: tipo === 'penale' ? Number(importo) : undefined,
          stanza:       cancelState.pren.stanza,
          ospite:       cancelState.pren.ospite,
          eventId:      cancelState.pren.eventId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore cancellazione');
      const msg = buildCancelWhatsApp(cancelState.pren, tipo, importo);
      setCancelState(prev => prev ? { ...prev, step: 'done', penaleType: tipo, importo, msg } : null);
      loadPrenotazioni();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setCancelLoading(false);
    }
  }

  async function copyCancelMsg() {
    if (!cancelState?.msg) return;
    try {
      await navigator.clipboard.writeText(cancelState.msg);
      setCancelCopied(true);
      setTimeout(() => setCancelCopied(false), 2500);
    } catch { /* */ }
  }

  // Filtra: non mostrare cancellate
  const activePren  = prenotazioni.filter(p => !p.stato.toLowerCase().includes('cancellat'));
  const futurePren  = activePren.filter(p => isFuture(p.checkout));
  const pastPren    = activePren.filter(p => !isFuture(p.checkout));
  const displayPren = showStorico ? activePren : futurePren;

  // ── SUCCESS VIEW ──────────────────────────────────────────────────────────

  if (success) {
    const msg = buildWhatsApp(success);
    return (
      <div style={css.page}>
        <div style={css.wrap}>

          <Logo />

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }}>✅</div>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#1C1C1E', margin: '0 0 4px', fontFamily: FONT }}>
              Prenotazione salvata!
            </p>
            <p style={{ fontSize: 14, color: '#6E6E73', margin: 0, fontFamily: FONT }}>
              Google Sheets e Calendar aggiornati
            </p>
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1.5px solid #EFEAE3',
            borderRadius: 20,
            padding: '16px 20px',
            marginBottom: 16,
            boxShadow: CARD_SHADOW,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px 20px',
          }}>
            {([
              ['Stanza',  success.stanza],
              ['Canale',  success.canale],
              ['Ospite',  success.ospite],
              ['Notti',   String(calcNights(success.checkin, success.checkout))],
              ['Lordo',   `€${success.lordo}`],
              ['Utile',   `€${success.utile}`],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#FF5A5F', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2, fontFamily: FONT }}>{k}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', fontFamily: FONT }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#EFEAE3', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: '#FF5A5F', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px', fontFamily: FONT }}>
              Messaggio WhatsApp
            </p>
            <pre style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: 13, color: '#1C1C1E', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, lineHeight: 1.65 }}>
              {msg}
            </pre>
          </div>

          <button onClick={onCopy} style={{ ...css.btnTeal, marginBottom: 12, background: copied ? '#178a58' : '#1FAA6E' }}>
            {copied ? '✓ Copiato negli appunti!' : '📋 Copia messaggio'}
          </button>
          <button onClick={onReset} style={css.btnOutline}>
            + Nuova prenotazione
          </button>

        </div>
      </div>
    );
  }

  // ── MAIN VIEW ─────────────────────────────────────────────────────────────

  return (
    <div style={css.page}>
      <div style={css.wrap}>

        <Logo />

        {/* ── Prenotazioni ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1E', margin: 0, fontFamily: FONT_DISPLAY, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {showStorico ? 'Tutte le prenotazioni' : 'Prenotazioni future'}
            </h2>
            {pastPren.length > 0 && (
              <button
                onClick={() => setShowStorico(v => !v)}
                style={{ fontSize: 12, color: '#1FAA6E', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 500, padding: 0 }}
              >
                {showStorico ? 'Nascondi storico' : `Vedi storico (${pastPren.length})`}
              </button>
            )}
          </div>

          {loadingPren && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#6E6E73', fontSize: 14, fontFamily: FONT }}>
              Caricamento…
            </div>
          )}

          {!loadingPren && errorPren && (
            <div style={{ background: '#FBE0E1', border: '1px solid #F5C2C4', borderRadius: 10, padding: '12px 16px' }}>
              <p style={{ color: '#E5484D', fontSize: 14, margin: 0, fontFamily: FONT }}>❌ {errorPren}</p>
            </div>
          )}

          {!loadingPren && !errorPren && displayPren.length === 0 && (
            <div style={{ background: '#FFFFFF', border: '1.5px solid #EFEAE3', borderRadius: 20, padding: '18px 20px', textAlign: 'center' }}>
              <p style={{ color: '#6E6E73', fontSize: 14, margin: 0, fontFamily: FONT }}>
                Nessuna prenotazione{showStorico ? '' : ' futura'}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayPren.map(p => {
              const nights = calcNightsIT(p.checkin, p.checkout);
              const isPast = !isFuture(p.checkout);
              return (
                <div key={p.row} style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #EFEAE3',
                  borderRadius: 20,
                  boxShadow: CARD_SHADOW,
                  padding: '14px 16px',
                  opacity: isPast ? 0.65 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', fontFamily: FONT }}>{p.stanza}</span>
                    <BadgeCanale canale={p.canale} />
                  </div>
                  <div style={{ fontSize: 14, color: '#1C1C1E', marginBottom: 5, fontFamily: FONT }}>{p.ospite}</div>
                  <div style={{ fontSize: 13, color: '#6E6E73', marginBottom: 8, fontFamily: FONT }}>
                    📅 {p.checkin} → {p.checkout}
                    <span style={{ marginLeft: 6, fontSize: 12, color: '#FF5A5F', fontWeight: 500 }}>
                      {nights} nott{nights === 1 ? 'e' : 'i'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#065F46', fontWeight: 600, fontFamily: FONT }}>
                      {p.utile != null ? `Utile: €${p.utile}` : ''}
                    </span>
                    {sessione.puoCancellare && (
                      <button onClick={() => startCancella(p)} style={css.btnRed}>
                        Cancella
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Form ── */}
        {sessione.puoCreare && (
        <div style={{ borderTop: '1.5px solid #EFEAE3', paddingTop: 24 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1E', margin: '0 0 16px 2px', fontFamily: FONT_DISPLAY, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Nuova prenotazione
          </h2>

          <div style={css.card}>
            <form onSubmit={onSubmit} noValidate>

              <Field label="Check-in">
                <input type="date" name="checkin" value={form.checkin} onChange={onChange} required style={css.input} />
              </Field>

              <Field label="Check-out">
                <input type="date" name="checkout" value={form.checkout} onChange={onChange} min={form.checkin || undefined} required style={css.input} />
              </Field>

              <Field label="Ospite">
                <input type="text" name="ospite" value={form.ospite} onChange={onChange} placeholder="Nome e cognome" autoCapitalize="words" autoComplete="off" required style={css.input} />
              </Field>

              <Field label="Telefono (facoltativo)">
                <input type="tel" name="telefono" value={form.telefono} onChange={onChange} placeholder="Es. 333 1234567" autoComplete="off" style={css.input} />
              </Field>

              <Field label="Stanza">
                <select name="stanza" value={form.stanza} onChange={onChange} required style={css.input}>
                  <option value="">Seleziona stanza…</option>
                  {STANZE.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Canale">
                <select name="canale" value={form.canale} onChange={onChange} required style={css.input}>
                  <option value="">Seleziona canale…</option>
                  {CANALI.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="Lordo €" last>
                <input type="number" name="lordo" value={form.lordo} onChange={onChange} placeholder="0.00" min="0" step="0.01" inputMode="decimal" required style={css.input} />
              </Field>

              {error && (
                <div style={{ background: '#FBE0E1', border: '1px solid #F5C2C4', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                  <p style={{ color: '#E5484D', fontSize: 14, margin: 0, fontFamily: FONT }}>❌ {error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-dark"
                style={{ ...css.btnDark, opacity: loading ? 0.65 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? '⏳ Salvataggio in corso…' : 'Salva prenotazione'}
              </button>

            </form>
          </div>
        </div>
        )}

      </div>

      {/* ── Cancellation modal (bottom sheet) ── */}
      {cancelState && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px 20px 0 0',
            padding: '24px 20px 36px',
            width: '100%',
            maxWidth: 480,
            fontFamily: FONT,
          }}>

            {/* Step: ask penale */}
            {cancelState.step === 'ask' && (
              <>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: '0 0 4px', fontFamily: FONT_DISPLAY }}>
                  Cancella prenotazione
                </h3>
                <p style={{ fontSize: 14, color: '#6E6E73', margin: '0 0 20px' }}>
                  {cancelState.pren.stanza} · {cancelState.pren.ospite}
                </p>
                <p style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E', margin: '0 0 14px' }}>
                  La cancellazione è con penale?
                </p>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <button
                    onClick={() => setCancelState(p => p ? { ...p, penaleType: 'penale', step: 'amount' } : null)}
                    disabled={cancelLoading}
                    style={{
                      flex: 1, height: 48,
                      background: '#FBE0E1', color: '#E5484D',
                      border: '1.5px solid #F5C2C4',
                      borderRadius: 14, fontSize: 15, fontWeight: 600,
                      cursor: 'pointer', fontFamily: FONT,
                    }}
                  >
                    Con penale
                  </button>
                  <button
                    onClick={() => confirmCancella('nessuna', '')}
                    disabled={cancelLoading}
                    style={{
                      flex: 1, height: 48,
                      background: '#F5F0EA', color: '#6E6E73',
                      border: '1.5px solid #EFEAE3',
                      borderRadius: 14, fontSize: 15, fontWeight: 600,
                      cursor: cancelLoading ? 'not-allowed' : 'pointer', fontFamily: FONT,
                      opacity: cancelLoading ? 0.6 : 1,
                    }}
                  >
                    {cancelLoading ? '⏳' : 'Senza penale'}
                  </button>
                </div>
                <button onClick={() => setCancelState(null)} style={{ ...css.btnOutline, height: 44, fontSize: 14 }}>
                  Annulla
                </button>
              </>
            )}

            {/* Step: amount input */}
            {cancelState.step === 'amount' && (
              <>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: '0 0 4px', fontFamily: FONT_DISPLAY }}>
                  Importo penale
                </h3>
                <p style={{ fontSize: 14, color: '#6E6E73', margin: '0 0 20px' }}>
                  {cancelState.pren.stanza} · {cancelState.pren.ospite}
                </p>
                <label style={css.label}>Importo penale €</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={cancelState.importo}
                  onChange={e => setCancelState(p => p ? { ...p, importo: e.target.value } : null)}
                  style={{ ...css.input, marginBottom: 16 }}
                  autoFocus
                />
                <button
                  onClick={() => confirmCancella('penale', cancelState.importo)}
                  disabled={cancelLoading || !cancelState.importo}
                  style={{
                    ...css.btnRed,
                    display: 'block', width: '100%',
                    height: 52, fontSize: 16, borderRadius: 14,
                    marginBottom: 10,
                    opacity: (!cancelState.importo || cancelLoading) ? 0.55 : 1,
                    cursor: (!cancelState.importo || cancelLoading) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cancelLoading ? '⏳ Annullamento…' : 'Conferma cancellazione'}
                </button>
                <button
                  onClick={() => setCancelState(p => p ? { ...p, step: 'ask', penaleType: null } : null)}
                  style={{ ...css.btnOutline, height: 44, fontSize: 14 }}
                >
                  Indietro
                </button>
              </>
            )}

            {/* Step: done */}
            {cancelState.step === 'done' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>✅</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: '0 0 4px', fontFamily: FONT_DISPLAY }}>
                    Prenotazione cancellata
                  </h3>
                  <p style={{ fontSize: 14, color: '#6E6E73', margin: 0 }}>
                    Sheets e Calendar aggiornati
                  </p>
                </div>
                <div style={{ background: '#F5F0EA', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: '#6E6E73', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px', fontFamily: FONT }}>
                    Messaggio WhatsApp
                  </p>
                  <pre style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: 12, color: '#1C1C1E', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>
                    {cancelState.msg}
                  </pre>
                </div>
                <button
                  onClick={copyCancelMsg}
                  style={{ ...css.btnTeal, marginBottom: 10, background: cancelCopied ? '#178a58' : '#1FAA6E' }}
                >
                  {cancelCopied ? '✓ Copiato!' : '📋 Copia messaggio'}
                </button>
                <button
                  onClick={() => { setCancelState(null); setCancelCopied(false); }}
                  style={{ ...css.btnOutline, height: 44, fontSize: 14 }}
                >
                  Chiudi
                </button>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
