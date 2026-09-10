'use client';

import { useEffect, useMemo, useState } from 'react';
import { CHECKLIST_STANDARD, OPERATORE_DEFAULT, LELLA_TELEFONO, toWaNumber, type PulizieStato } from '@/lib/pulizie';

// Stessa forma restituita da GET /api/prenotazioni (vedi src/app/api/prenotazioni/route.ts).
// Qui servono solo i campi usati per calcolare i check-out imminenti e mostrarli.
type Prenotazione = {
  row: number;
  checkin: string;   // DD/MM/YYYY
  checkout: string;  // DD/MM/YYYY
  ospite: string;
  stanza: string;
  canale: string;
  stato: string;
};

// Checklist standard di pulizia — coerente con quanto già documentato in wiki/sintesi/messaggi-checkin-ospiti.md
// (cialde caffè/colazione già in camera, non in cucina condivisa).
// Definizione condivisa con la route API in src/lib/pulizie.ts (schema colonne scheda "PULIZIE").

function parseItDate(s: string): Date | null {
  const [d, m, y] = (s || '').split('/').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}
function todayMid() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function giornoInfo(d: Date, today: Date): { etichetta: string; sub: string; accento: 'urgent' | 'warn' | 'neutral' } {
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const dataEstesa = capitalize(d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));
  if (diff === 0) return { etichetta: 'Oggi', sub: dataEstesa, accento: 'urgent' };
  if (diff === 1) return { etichetta: 'Domani', sub: dataEstesa, accento: 'warn' };
  return { etichetta: capitalize(d.toLocaleDateString('it-IT', { weekday: 'long' })), sub: dataEstesa, accento: 'neutral' };
}

type PrenotazioneConCheckout = Prenotazione & { co: Date };

// Chiave usata per incrociare una prenotazione (data check-out DD/MM/YYYY + stanza) con la
// riga di stato corrispondente sulla scheda "PULIZIE" letta da GET /api/pulizie-stato.
function chiaveStato(data: string, stanza: string): string {
  return `${data}|${stanza.trim().toLowerCase()}`;
}

function vociVuote(): boolean[] {
  return CHECKLIST_STANDARD.map(() => false);
}

function waLinkPerStanza(p: Prenotazione, dataEstesa: string, voci: boolean[]): string | null {
  const num = toWaNumber(LELLA_TELEFONO);
  if (!num) return null;
  const daFare = CHECKLIST_STANDARD.filter((_, i) => !voci[i]);
  const elenco = (daFare.length > 0 ? daFare : CHECKLIST_STANDARD).map((v) => `• ${v}`).join('\n');
  const nota = daFare.length === 0 ? '\n\n(risulta già tutto completato, ricontrolla se serve)' : '';
  // Niente prefisso "Stanza" fisso: il nome della stanza (es. "Tulipano", "Rosa", "Piano Terra")
  // è già autoesplicativo così com'è nel foglio, e in alcuni casi include già la parola "Stanza".
  const testo =
    `🧹 Pulizie — ${p.stanza}\n` +
    `Check-out: ${dataEstesa}\n` +
    `Ospite: ${p.ospite}\n\n` +
    `${elenco}${nota}\n\n` +
    `Grazie Lella! 💛`;
  return `https://wa.me/${num}?text=${encodeURIComponent(testo)}`;
}

type CardPuliziaProps = {
  p: Prenotazione;
  dataEstesa: string;
  stato: PulizieStato | undefined;
  onToggle: (voceIndex: number, checked: boolean, operatoreCorrente: string) => void;
  onOperatoreChange: (operatore: string) => void;
  onNoteChange: (note: string) => void;
  saving: boolean;
};

function CardPulizia({ p, dataEstesa, stato, onToggle, onOperatoreChange, onNoteChange, saving }: CardPuliziaProps) {
  const voci = stato?.voci ?? vociVuote();
  const [operatore, setOperatore] = useState(stato?.operatore || OPERATORE_DEFAULT);
  const [nota, setNota] = useState(stato?.note ?? '');

  useEffect(() => {
    if (stato?.operatore) setOperatore(stato.operatore);
  }, [stato?.operatore]);

  useEffect(() => {
    setNota(stato?.note ?? '');
  }, [stato?.note]);

  const completate = voci.filter(Boolean).length;
  const tutteFatte = completate === CHECKLIST_STANDARD.length;
  const link = waLinkPerStanza(p, dataEstesa, voci);

  return (
    <div
      style={{
        background: 'var(--surface-soft)', borderRadius: 'var(--r-panel)',
        padding: '1.1rem 1.2rem', boxShadow: 'var(--shadow-sm)', minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '.6rem', marginBottom: '.4rem' }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{p.stanza}</strong>
        <span className={'badge ' + (tutteFatte ? 'urgent' : 'neutral')} style={tutteFatte ? { background: 'var(--ok-bg, #dff5e1)', color: 'var(--ok-ink, #16702a)' } : undefined}>
          {tutteFatte ? 'Completata' : `${completate}/${CHECKLIST_STANDARD.length}`}
        </span>
      </div>
      <p style={{ margin: '0 0 .7rem', fontSize: '.82rem', color: 'var(--ink-muted)' }}>{p.ospite} · {p.canale}</p>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
        {CHECKLIST_STANDARD.map((voce, i) => (
          <li key={voce} style={{ fontSize: '.85rem', fontWeight: 500 }}>
            {/* <label> invece di input+span slegati: così tutta la riga è cliccabile, non solo
                il quadratino 15x15 — su mobile era un tap target troppo piccolo. */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '.55rem', padding: '.3rem 0', margin: '-.3rem 0', cursor: saving ? 'wait' : 'pointer' }}>
              <input
                type="checkbox"
                checked={!!voci[i]}
                disabled={saving}
                onChange={(e) => onToggle(i, e.target.checked, operatore)}
                style={{ marginTop: '.15rem', flex: 'none', width: 15, height: 15, cursor: saving ? 'wait' : 'pointer' }}
              />
              <span style={{ textDecoration: voci[i] ? 'line-through' : 'none', color: voci[i] ? 'var(--ink-muted)' : 'inherit' }}>{voce}</span>
            </label>
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.9rem', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '.78rem', color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          Operatore:
          <input
            type="text"
            value={operatore}
            onChange={(e) => setOperatore(e.target.value)}
            onBlur={() => { if (operatore.trim()) onOperatoreChange(operatore.trim()); }}
            style={{
              fontSize: '.78rem', padding: '.15rem .4rem', borderRadius: '.4rem',
              border: '1px solid var(--ink-faint)', width: '6.5rem', background: 'var(--surface)',
            }}
          />
        </label>
        {stato?.completatoIl && (
          <span style={{ fontSize: '.72rem', color: 'var(--ink-faint)' }}>
            completata il {new Date(stato.completatoIl).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <label style={{ display: 'block', marginTop: '.7rem' }}>
        <span style={{ fontSize: '.78rem', color: 'var(--ink-muted)', display: 'block', marginBottom: '.25rem' }}>Nota (facoltativa)</span>
        <input
          type="text"
          value={nota}
          placeholder="Es. manca il sapone, chiave lasciata dentro..."
          onChange={(e) => setNota(e.target.value)}
          onBlur={() => onNoteChange(nota.trim())}
          style={{
            fontSize: '.82rem', padding: '.35rem .5rem', borderRadius: '.5rem', width: '100%',
            border: '1px solid var(--ink-faint)', background: 'var(--surface)', color: 'inherit',
          }}
        />
      </label>

      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="badge neutral"
          style={{ display: 'inline-block', marginTop: '.7rem', textDecoration: 'none', cursor: 'pointer' }}
        >
          📲 Invia a Lella su WhatsApp
        </a>
      )}
    </div>
  );
}

export default function PulizieChecklist() {
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [stati, setStati] = useState<Record<string, PulizieStato>>({});
  const [salvataggi, setSalvataggi] = useState<Record<string, boolean>>({});
  const [avvisoStato, setAvvisoStato] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/prenotazioni')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d && d.ok) setPrenotazioni(d.prenotazioni);
        else setErrore(d?.error || 'Errore sconosciuto nel caricamento delle prenotazioni.');
      })
      .catch((e) => { if (!cancelled) setErrore(String(e)); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pulizie-stato')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d && d.ok) {
          const mappa: Record<string, PulizieStato> = {};
          for (const s of d.stati as PulizieStato[]) mappa[chiaveStato(s.data, s.stanza)] = s;
          setStati(mappa);
        } else {
          setAvvisoStato(d?.error || 'Stato pulizie non disponibile: le spunte non verranno salvate.');
        }
      })
      .catch((e) => { if (!cancelled) setAvvisoStato(String(e)); });
    return () => { cancelled = true; };
  }, []);

  const today = useMemo(() => todayMid(), []);
  const orizzonte = useMemo(() => new Date(today.getTime() + 2 * 86400000), [today]);

  const gruppiPerGiorno = useMemo(() => {
    if (!prenotazioni) return [];

    const imminenti: PrenotazioneConCheckout[] = prenotazioni
      .filter((p) => (p.stato || '').toLowerCase() === 'attiva')
      .map((p) => ({ ...p, co: parseItDate(p.checkout) }))
      .filter((p): p is PrenotazioneConCheckout => !!p.co && p.co >= today && p.co <= orizzonte)
      .sort((a, b) => a.co.getTime() - b.co.getTime() || a.stanza.localeCompare(b.stanza));

    const mappa = new Map<string, { data: Date; voci: PrenotazioneConCheckout[] }>();
    for (const p of imminenti) {
      const chiave = p.co.toISOString().slice(0, 10);
      if (!mappa.has(chiave)) mappa.set(chiave, { data: p.co, voci: [] });
      mappa.get(chiave)!.voci.push(p);
    }
    return Array.from(mappa.values()).sort((a, b) => a.data.getTime() - b.data.getTime());
  }, [prenotazioni, today, orizzonte]);

  async function salva(p: Prenotazione, dataChiave: string, voceIndex: number, checked: boolean, operatore: string, note?: string) {
    const key = chiaveStato(dataChiave, p.stanza);

    // Aggiornamento ottimistico: aggiorna subito la UI, prima della risposta del server.
    setStati((prev) => {
      const attuale = prev[key];
      const voci = attuale ? [...attuale.voci] : vociVuote();
      voci[voceIndex] = checked;
      return {
        ...prev,
        [key]: {
          row: attuale?.row ?? -1,
          data: dataChiave,
          stanza: p.stanza,
          ospite: p.ospite,
          voci,
          operatore,
          completatoIl: attuale?.completatoIl ?? '',
          note: note ?? attuale?.note ?? '',
        },
      };
    });
    setSalvataggi((prev) => ({ ...prev, [key]: true }));

    try {
      const res = await fetch('/api/pulizie-stato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataChiave, stanza: p.stanza, ospite: p.ospite, voceIndex, checked, operatore, ...(note !== undefined ? { note } : {}) }),
      });
      const d = await res.json();
      if (d && d.ok) {
        setStati((prev) => ({ ...prev, [key]: d.stato }));
      } else {
        throw new Error(d?.error || 'Errore sconosciuto nel salvataggio');
      }
    } catch (e) {
      // Rollback: annulla la spunta ottimistica se il salvataggio fallisce.
      setStati((prev) => {
        const attuale = prev[key];
        if (!attuale) return prev;
        const voci = [...attuale.voci];
        voci[voceIndex] = !checked;
        return { ...prev, [key]: { ...attuale, voci } };
      });
      setAvvisoStato(`Salvataggio non riuscito per ${p.stanza}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSalvataggi((prev) => ({ ...prev, [key]: false }));
    }
  }

  if (errore) {
    return (
      <div className="panel full">
        <h3>Checklist pulizie</h3>
        <p style={{ color: 'var(--ink-muted)' }}>Non riesco a leggere le prenotazioni al momento ({errore}). Riprova tra poco.</p>
      </div>
    );
  }

  if (!prenotazioni) {
    return (
      <div className="panel full">
        <h3>Checklist pulizie</h3>
        <p style={{ color: 'var(--ink-muted)' }}>Caricamento prenotazioni…</p>
      </div>
    );
  }

  return (
    <div className="panel full">
      <h3>Checklist pulizie — check-out oggi e prossimi 2 giorni</h3>

      {avvisoStato && (
        <p style={{ color: 'var(--warn-ink, #a15c00)', fontSize: '.8rem', marginTop: '-.4rem', marginBottom: '.9rem' }}>
          ⚠️ {avvisoStato}
        </p>
      )}

      {gruppiPerGiorno.length === 0 && (
        <p style={{ color: 'var(--ink-muted)' }}>Nessun check-out previsto oggi o nei prossimi 2 giorni.</p>
      )}

      {gruppiPerGiorno.map(({ data, voci }) => {
        const info = giornoInfo(data, today);
        const dataChiave = [
          String(data.getDate()).padStart(2, '0'),
          String(data.getMonth() + 1).padStart(2, '0'),
          String(data.getFullYear()),
        ].join('/');
        return (
          <div className="day-group" key={data.toISOString()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.9rem', flexWrap: 'wrap' }}>
              <span className={'badge ' + info.accento}>{info.etichetta}</span>
              <span style={{ fontSize: '.82rem', color: 'var(--ink-muted)', fontWeight: 600 }}>
                {info.sub} · check-out entro le 10:00
              </span>
            </div>
            <div style={{ display: 'grid', gap: '.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {voci.map((p) => {
                const key = chiaveStato(dataChiave, p.stanza);
                return (
                  <CardPulizia
                    key={p.row}
                    p={p}
                    dataEstesa={info.sub}
                    stato={stati[key]}
                    saving={!!salvataggi[key]}
                    onToggle={(voceIndex, checked, operatore) => salva(p, dataChiave, voceIndex, checked, operatore)}
                    onOperatoreChange={(operatore) => {
                      const attuale = stati[key];
                      const primaVoceChecked = attuale?.voci?.[0] ?? false;
                      salva(p, dataChiave, 0, primaVoceChecked, operatore);
                    }}
                    onNoteChange={(note) => {
                      const attuale = stati[key];
                      const primaVoceChecked = attuale?.voci?.[0] ?? false;
                      const operatoreCorrente = attuale?.operatore || OPERATORE_DEFAULT;
                      salva(p, dataChiave, 0, primaVoceChecked, operatoreCorrente, note);
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      <p style={{ color: 'var(--ink-faint)', fontSize: '.8rem', marginTop: '1.3rem' }}>
        Le spunte sono salvate sulla scheda &quot;PULIZIE&quot; del foglio Google (stesso spreadsheet delle prenotazioni) — persistono tra un
        aggiornamento e l&apos;altro della pagina. Il pulsante WhatsApp avvisa Lella con l&apos;elenco delle voci ancora da fare per quella stanza.
      </p>
    </div>
  );
}
