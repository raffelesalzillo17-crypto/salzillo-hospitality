'use client';

import { PushToggle, StileToggle, TemaToggle } from './ui';

// Menu laterale (24/11/2026): su telefono sostituisce la barra in basso. Si apre dal pulsante ☰ in alto, scorre da sinistra
// come un pannello di vetro e raggruppa le sezioni per ciò che si fa (non per ordine di creazione). Sul computer restano le schede in alto.

const GRUPPI: { titolo: string; voci: string[] }[] = [
  { titolo: 'Ogni giorno', voci: ['dashboard', 'calendario', 'prenotazioni', 'documenti', 'pulizie'] },
  { titolo: 'Ospiti', voci: ['ospiti', 'documentiospiti', 'promemoria'] },
  { titolo: 'Adempimenti', voci: ['alloggiati', 'adempimenti'] },
  { titolo: 'Conti', voci: ['rendiconti', 'spese', 'scadenze'] },
  { titolo: 'Gestione', voci: ['immobili', 'link', 'registro', 'guida'] },
];

const ICONE: Record<string, string> = {
  dashboard: '📊', calendario: '📅', prenotazioni: '📋', documenti: '📄', pulizie: '🧹', ospiti: '👥', documentiospiti: '🗂️', promemoria: '💬',
  alloggiati: '🛂', adempimenti: '📑', rendiconti: '💶', spese: '🧾', scadenze: '⏰', immobili: '🏠', link: '🔗', registro: '🔒', guida: '❓',
};

export function MenuLaterale({ aperto, onChiudi, visibili, tab, etichetta, onScegli, nome, onLink, onEsci }: {
  aperto: boolean; onChiudi: () => void; visibili: string[]; tab: string; etichetta: (t: string) => string;
  onScegli: (t: string) => void; nome: string; onLink: () => void; onEsci: () => void;
}) {
  return (
    <>
      <div className={'velo' + (aperto ? ' aperto' : '')} onClick={onChiudi} />
      <aside className={'drawer' + (aperto ? ' aperto' : '')} aria-hidden={!aperto} aria-label="Menu">
        <div className="drawerhead">
          <div><span className="eyebrow">Salzillo Hospitality</span><div className="drawertitolo">Gestionale</div></div>
          <button className="drawerx" onClick={onChiudi} aria-label="Chiudi il menu">✕</button>
        </div>
        <nav>
          {GRUPPI.map((g) => {
            const voci = g.voci.filter((v) => visibili.includes(v));
            if (!voci.length) return null;
            return (
              <div key={g.titolo} className="drawergruppo">
                <span>{g.titolo}</span>
                {voci.map((v) => (
                  <button key={v} className={tab === v ? 'on' : ''} onClick={() => onScegli(v)}>
                    <i>{ICONE[v] ?? '•'}</i>{etichetta(v)}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="drawerfoot">
          <span className="hint">👤 {nome}</span>
          <div className="drawerlink">
            <button className="mini" onClick={onLink}>🔗 Il mio link</button>
            <button className="mini" onClick={onEsci}>Esci</button>
          </div>
          <div className="drawertoggle"><PushToggle /><StileToggle /><TemaToggle /></div>
        </div>
      </aside>
    </>
  );
}
