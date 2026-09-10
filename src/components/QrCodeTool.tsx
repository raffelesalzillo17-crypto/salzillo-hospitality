'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { STRUTTURE } from '@/lib/strutture';

// Elenco stanze ora derivato da src/lib/strutture.ts (09/09/2026) invece di un elenco locale
// fisso a Tulipano/Rosa — vedi quel file per il perché. Solo le stanze con una guida di
// check-in pubblicata compaiono qui (checkinGuideUrl presente): ha senso stampare un foglio QR
// solo per una struttura che ha già una pagina da linkare.
type RoomKey = string; // nome della struttura, es. 'Tulipano', 'Piano Terra'...

const ROOMS: Record<RoomKey, { label: string; checkinUrl: string; indirizzo: string; wifi?: { ssid: string; password: string } }> =
  Object.fromEntries(
    STRUTTURE.filter((s) => s.checkinGuideUrl).map((s) => [
      s.nome,
      { label: s.nome, checkinUrl: s.checkinGuideUrl!, indirizzo: s.indirizzo, wifi: s.wifi },
    ])
  );

const ROOM_KEYS = Object.keys(ROOMS);

const REVIEW_URL = 'https://g.page/r/CVxuMMgN8XDNEAE/review';

type QrItem = {
  key: string;
  title: string;
  subtitle: string;
  dataUrl: string;
};

const QR_PIXEL_SIZE = 480; // alta risoluzione per una stampa nitida anche plastificata

async function makeQr(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: QR_PIXEL_SIZE,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1C1C1E', light: '#FFFFFF' },
  });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function QrCodeTool() {
  const [room, setRoom] = useState<RoomKey>(ROOM_KEYS[0]);
  const [items, setItems] = useState<QrItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [customText, setCustomText] = useState('');
  const [customItem, setCustomItem] = useState<QrItem | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);

    const roomInfo = ROOMS[room];

    // Il QR WiFi si genera SOLO se la struttura ha davvero una rete (roomInfo.wifi presente) —
    // per Via Campania (Piano Terra/Primo Piano/Secondo Piano) il WiFi non è ancora installato
    // (confermato 09/09/2026): un QR WiFi lì punterebbe a una rete inesistente sul posto, o
    // peggio alla rete di un'altra struttura fisica. Vedi src/lib/strutture.ts.
    const promises: Promise<string>[] = [makeQr(roomInfo.checkinUrl), makeQr(REVIEW_URL)];
    if (roomInfo.wifi) {
      promises.push(makeQr(`WIFI:T:WPA;S:${roomInfo.wifi.ssid};P:${roomInfo.wifi.password};;`));
    }

    Promise.all(promises)
      .then(([checkin, review, wifi]) => {
        if (cancelled) return;
        const nextItems: QrItem[] = [
          {
            key: 'checkin',
            title: 'Guida check-in',
            subtitle: `Istruzioni per ${roomInfo.label}`,
            dataUrl: checkin,
          },
          {
            key: 'review',
            title: 'Lascia una recensione',
            subtitle: 'Google — grazie in anticipo!',
            dataUrl: review,
          },
        ];
        if (wifi && roomInfo.wifi) {
          nextItems.unshift({
            key: 'wifi',
            title: 'WiFi',
            subtitle: `Rete “${roomInfo.wifi.ssid}” — connessione automatica`,
            dataUrl: wifi,
          });
        }
        setItems(nextItems);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Errore nella generazione dei QR code.');
      });

    return () => {
      cancelled = true;
    };
  }, [room]);

  async function handleGenerateCustom() {
    const text = customText.trim();
    if (!text) {
      setCustomError('Scrivi o incolla un link o un testo prima di generare il QR.');
      return;
    }
    setCustomLoading(true);
    setCustomError(null);
    try {
      const dataUrl = await makeQr(text);
      setCustomItem({
        key: 'custom',
        title: 'QR personalizzato',
        subtitle: text.length > 60 ? `${text.slice(0, 57)}…` : text,
        dataUrl,
      });
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : 'Errore nella generazione del QR code.');
      setCustomItem(null);
    } finally {
      setCustomLoading(false);
    }
  }

  return (
    <div className="qrct-root">
      <style>{QRCT_CSS}</style>

      <div className="qrct-toolbar qrct-noprint">
        <div className="qrct-tabs">
          {ROOM_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`qrct-tab${room === key ? ' active' : ''}`}
              onClick={() => setRoom(key)}
            >
              {ROOMS[key].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="qrct-print-btn"
          onClick={() => window.print()}
          disabled={!items}
        >
          Stampa foglio {ROOMS[room].label}
        </button>
      </div>

      {error && <p className="qrct-error qrct-noprint">{error}</p>}

      <div className="qrct-sheet">
        <h2 className="qrct-sheet-title">{ROOMS[room].indirizzo} — {ROOMS[room].label}</h2>
        <div className="qrct-grid">
          {(items ?? []).map((item) => (
            <div className="qrct-card" key={item.key}>
              <div className="qrct-img-wrap">
                <img src={item.dataUrl} alt={`QR code — ${item.title}`} />
              </div>
              <div className="qrct-label">
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </div>
              <button
                type="button"
                className="qrct-download-btn qrct-noprint"
                onClick={() => downloadDataUrl(item.dataUrl, `qr-${room.toLowerCase().replace(/\s+/g, '-')}-${item.key}.png`)}
              >
                Scarica PNG
              </button>
            </div>
          ))}
          {!items && !error && (
            <p className="qrct-loading qrct-noprint">Generazione QR in corso…</p>
          )}
        </div>
      </div>

      <div className="qrct-custom-section qrct-noprint">
        <h2 className="qrct-sheet-title">Genera un QR personalizzato</h2>
        <p className="qrct-custom-hint">Incolla un link o scrivi un testo qualunque: il QR viene generato al volo.</p>
        <div className="qrct-custom-form">
          <input
            type="text"
            className="qrct-custom-input"
            placeholder="https://... oppure un testo qualsiasi"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerateCustom();
            }}
          />
          <button
            type="button"
            className="qrct-print-btn"
            onClick={handleGenerateCustom}
            disabled={customLoading}
          >
            {customLoading ? 'Generazione…' : 'Genera'}
          </button>
        </div>
        {customError && <p className="qrct-error">{customError}</p>}

        {customItem && (
          <div className="qrct-grid qrct-custom-result">
            <div className="qrct-card">
              <div className="qrct-img-wrap">
                <img src={customItem.dataUrl} alt={`QR code personalizzato — ${customItem.subtitle}`} />
              </div>
              <div className="qrct-label">
                <strong>{customItem.title}</strong>
                <span>{customItem.subtitle}</span>
              </div>
              <button
                type="button"
                className="qrct-download-btn"
                onClick={() => downloadDataUrl(customItem.dataUrl, 'qr-personalizzato.png')}
              >
                Scarica PNG
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const QRCT_CSS = `
.qrct-root{ --qrct-ink:#1C1C1E; --qrct-ink-muted:#6E6E73; --qrct-line:#EFEAE3; --qrct-surface:#FFFFFF;
  --qrct-coral:#FF5A5F; --qrct-coral-soft:#FFE7E4; font-family:'Inter','SF Pro Text','Segoe UI',sans-serif; color:var(--qrct-ink); }
.qrct-toolbar{ display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:1.2rem; }
.qrct-tabs{ display:flex; gap:.5rem; background:var(--qrct-line); padding:.3rem; border-radius:12px; }
.qrct-tab{ border:none; background:transparent; padding:.5rem 1rem; border-radius:9px; font-size:.85rem; font-weight:600;
  color:var(--qrct-ink-muted); cursor:pointer; font-family:inherit; }
.qrct-tab.active{ background:var(--qrct-surface); color:var(--qrct-ink); box-shadow:0 1px 3px rgba(0,0,0,.12); }
.qrct-print-btn{ border:none; background:var(--qrct-coral); color:#fff; padding:.6rem 1.1rem; border-radius:10px;
  font-size:.85rem; font-weight:700; cursor:pointer; font-family:inherit; }
.qrct-print-btn:disabled{ opacity:.5; cursor:default; }
.qrct-error{ color:#E5484D; font-size:.85rem; }
.qrct-sheet-title{ font-size:1.1rem; font-weight:800; margin:0 0 1rem; }
.qrct-grid{ display:flex; gap:1.2rem; flex-wrap:wrap; justify-content:center; }
.qrct-card{ flex:1 1 220px; max-width:280px; background:var(--qrct-surface); border:1px solid var(--qrct-line);
  border-radius:16px; padding:1.1rem; display:flex; flex-direction:column; align-items:center; gap:.7rem; text-align:center; }
.qrct-img-wrap{ width:100%; aspect-ratio:1/1; display:flex; align-items:center; justify-content:center; }
.qrct-img-wrap img{ width:100%; height:100%; object-fit:contain; image-rendering:pixelated; }
.qrct-label{ display:flex; flex-direction:column; gap:.15rem; }
.qrct-label strong{ font-size:.95rem; font-weight:700; }
.qrct-label span{ font-size:.78rem; color:var(--qrct-ink-muted); }
.qrct-download-btn{ border:1px solid var(--qrct-line); background:transparent; color:var(--qrct-ink);
  padding:.4rem .8rem; border-radius:8px; font-size:.78rem; font-weight:600; cursor:pointer; font-family:inherit; }
.qrct-download-btn:hover{ background:var(--qrct-coral-soft); border-color:var(--qrct-coral); }
.qrct-loading{ color:var(--qrct-ink-muted); font-size:.85rem; }

.qrct-custom-section{ margin-top:2rem; padding-top:1.6rem; border-top:1px solid var(--qrct-line); }
.qrct-custom-hint{ font-size:.82rem; color:var(--qrct-ink-muted); margin:0 0 1rem; }
.qrct-custom-form{ display:flex; gap:.7rem; flex-wrap:wrap; margin-bottom:1rem; }
.qrct-custom-input{ flex:1 1 260px; border:1px solid var(--qrct-line); border-radius:10px; padding:.6rem .8rem;
  font-size:.9rem; font-family:inherit; color:var(--qrct-ink); background:var(--qrct-surface); }
.qrct-custom-input:focus{ outline:none; border-color:var(--qrct-coral); }
.qrct-custom-result{ margin-top:.5rem; }

@media print{
  .qrct-noprint{ display:none !important; }
  .qrct-root{ color:#000; }
  .qrct-sheet-title{ text-align:center; font-size:1.4rem; margin-bottom:1.5rem; }
  .qrct-grid{ flex-wrap:nowrap; justify-content:space-between; gap:.8rem; }
  .qrct-card{ border:1px solid #ccc; box-shadow:none; break-inside:avoid; max-width:none; flex:1 1 0; }
  .qrct-img-wrap img{ image-rendering:auto; }
}
`;
