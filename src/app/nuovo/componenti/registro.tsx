'use client';

import { useState } from 'react';
import type { Dati } from '../tipi';
import { api } from '../utilita';

// ── Registro delle azioni, cestino e controllo Drive (solo Titolare) ─────────────────────
// Punto 5 delle richieste, 23/11/2026. Il registro dice chi ha fatto cosa e quando, senza mai
// riportare dati degli ospiti. Il cestino tiene per 30 giorni gli ospiti e i preventivi eliminati.

const NOMI_AZIONE: Record<string, string> = {
  'crea-prenotazione': 'Prenotazione creata', 'aggiorna-prenotazione': 'Prenotazione modificata', 'cancella-prenotazione': 'Prenotazione cancellata',
  'crea-ospite': 'Ospite creato', 'aggiorna-ospite': 'Ospite modificato', 'elimina-ospite': 'Ospite eliminato (nel cestino)',
  'aggiungi-pagamento': 'Pagamento registrato', 'crea-proprietario': 'Proprietario creato', 'aggiorna-proprietario': 'Proprietario modificato',
  'elimina-proprietario': 'Proprietario eliminato', 'crea-immobile': 'Immobile creato', 'aggiorna-immobile': 'Immobile modificato',
  'elimina-immobile': 'Immobile eliminato', 'crea-alloggio': 'Alloggio creato', 'aggiorna-alloggio': 'Alloggio modificato',
  'elimina-alloggio': 'Alloggio eliminato', 'crea-spesa': 'Spesa creata', 'crea-scadenza': 'Scadenza creata', 'completa-scadenza': 'Scadenza completata',
  'crea-preventivo': 'Preventivo creato', 'stato-preventivo': 'Stato preventivo cambiato', 'accetta-preventivo': 'Preventivo accettato',
  'elimina-preventivo': 'Preventivo eliminato (nel cestino)', 'conferma-pulizia': 'Pulizia confermata', 'crea-pulizia': 'Pulizia creata',
  'elimina-pulizia': 'Pulizia eliminata', 'invita-collaboratore': 'Accesso creato', 'link-accesso': 'Link personale mostrato o rigenerato',
  'attiva-utente': 'Accesso attivato/disattivato', 'imposta-permesso': 'Permesso cambiato', 'elimina-operatore-pulizie': 'Operatore eliminato',
  'mostra-password-wifi': 'Password WiFi mostrata', 'mostra-numero-documento': 'Numero documento mostrato', 'rivela-negato': 'Tentativo non permesso di vedere un dato',
  'ripristina-dal-cestino': 'Ripristinato dal cestino', 'crea-prezzo': 'Prezzo impostato', 'cancella-prezzo': 'Prezzo rimosso',
  'crea-evento': 'Evento creato', 'cancella-evento': 'Evento rimosso', 'controlla-drive': 'Controllo condivisione Drive',
};
const nomeAzione = (a: string) => NOMI_AZIONE[a] ?? a.replace(/-/g, ' ');
const quando = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type EsitoDrive = {
  elementiControllati: number; cartelle: number; condivisionePubblica: number; tipiPubblici: Record<string, number>;
  condivisiConPersone: number; radiceCondivisaPubblicamente: boolean; ultimoBackup: string | null;
};

export function SezioneRegistro({ dati, onCambiato }: { dati: Dati; onCambiato: () => Promise<void> }) {
  const [busy, setBusy] = useState('');
  const [drive, setDrive] = useState<EsitoDrive | null>(null);
  const [errDrive, setErrDrive] = useState('');
  const registro = dati.registro ?? [];
  const cestino = dati.cestino ?? [];

  async function ripristina(id: string, etichetta: string) {
    if (!confirm(`Rimettere "${etichetta}" com'era?`)) return;
    setBusy(id);
    try { await api('ripristina-dal-cestino', { id }); await onCambiato(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  async function controllaDrive() {
    setBusy('drive'); setErrDrive(''); setDrive(null);
    try { setDrive(await api('controlla-drive') as EsitoDrive); await onCambiato(); }
    catch (e) { setErrDrive(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); }
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>Cestino <small>({cestino.length})</small></h2>
        <p className="sub">Gli ospiti e i preventivi eliminati restano qui 30 giorni e si possono rimettere com&apos;erano. Passato il termine spariscono per sempre.</p>
        {cestino.length === 0 ? <p className="empty">Il cestino è vuoto.</p> : (
          <table className="tbl"><tbody>
            {cestino.map((c) => (
              <tr key={c.id}>
                <td><b>{c.etichetta}</b> <small className="sub">({c.tipo === 'ospite' ? 'ospite' : 'preventivo'})</small></td>
                <td><small>eliminato il {quando(c.eliminatoIl)}<br />si recupera fino al {quando(c.scadeIl)}</small></td>
                <td className="num"><button className="mini" disabled={busy === c.id} onClick={() => ripristina(c.id, c.etichetta)}>↩ Ripristina</button></td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>

      <div className="card">
        <h2>Controllo cartelle Drive</h2>
        <p className="sub">Verifica, in sola lettura, se le cartelle con i documenti degli ospiti sono condivise con &quot;chiunque abbia il link&quot;. Non cambia nessuna impostazione e non mostra nomi.</p>
        <button className="add" disabled={busy === 'drive'} onClick={controllaDrive}>{busy === 'drive' ? 'Controllo in corso…' : 'Controlla ora'}</button>
        {errDrive && <p className="empty" style={{ color: '#d33' }}>{errDrive}</p>}
        {drive && (
          <div style={{ marginTop: 10 }}>
            <p style={{ color: drive.condivisionePubblica === 0 && !drive.radiceCondivisaPubblicamente ? '#1FAA6E' : '#d33', fontWeight: 700 }}>
              {drive.condivisionePubblica === 0 && !drive.radiceCondivisaPubblicamente
                ? '✓ Nessuna cartella o file è condiviso pubblicamente.'
                : `⚠️ ${drive.condivisionePubblica} elementi sono condivisi pubblicamente${drive.radiceCondivisaPubblicamente ? ' (compresa la cartella principale)' : ''}. Vanno resi privati da Google Drive.`}
            </p>
            <p className="sub">Controllati {drive.elementiControllati} elementi ({drive.cartelle} cartelle, un livello di sottocartelle). Condivisi con persone specifiche: {drive.condivisiConPersone}.
              {Object.keys(drive.tipiPubblici).length > 0 && <> Tipi: {Object.entries(drive.tipiPubblici).map(([k, n]) => `${k} ×${n}`).join(', ')}.</>}
              {drive.ultimoBackup && <> Ultimo backup cifrato: {quando(drive.ultimoBackup)}.</>}</p>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Registro delle azioni <small>(ultime {registro.length})</small></h2>
        <p className="sub">Chi ha fatto cosa e quando. Non contiene dati degli ospiti, solo il tipo di azione.</p>
        {registro.length === 0 ? <p className="empty">Ancora nessuna azione registrata.</p> : (
          <table className="tbl">
            <thead><tr><th>Quando</th><th>Chi</th><th>Cosa</th></tr></thead>
            <tbody>
              {registro.map((r) => (
                <tr key={r.id}>
                  <td><small>{quando(r.quando)}</small></td>
                  <td><small>{r.utente_nome ?? '—'}{r.ruolo ? ` (${r.ruolo})` : ''}</small></td>
                  <td>{nomeAzione(r.azione)}{r.dettaglio ? <small className="sub"> · {r.dettaglio}</small> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
