import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { utenti } from '@/lib/db/schema';
import { verificaChiaveAccesso } from '@/lib/db/auth';

// La pagina a cui porta il link personale di ogni persona (/entra?k=<chiave>): logo, saluto,
// un pulsante per entrare e le istruzioni per mettere l'app sul telefono o sul computer.
// Richiesta di Raffaele dell'11/11/2026: il link nudo portava dritto dentro senza spiegare come
// installarla e senza immagine nell'anteprima di WhatsApp.
//
// Questa pagina NON apre la sessione (lo fa il pulsante, /api/nuovo/entra): così l'anteprima
// che WhatsApp genera leggendo il link non "entra" da nessuna parte. Il manifest è quello
// personale (/api/nuovo/manifest?k=...): l'app installata da qui si apre sempre passando dalla
// chiave, quindi resta dentro anche dove l'app installata non condivide i dati del browser.

export const dynamic = 'force-dynamic';

const SITE = 'https://salzillo-hospitality.vercel.app';
type Props = { searchParams: Promise<{ k?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { k = '' } = await searchParams;
  return {
    title: 'Salzillo Hospitality — il tuo accesso',
    description: 'Il tuo link personale per entrare nel gestionale. Non inoltrarlo a nessuno.',
    manifest: /^[A-Za-z0-9_-]{40,}$/.test(k) ? `/api/nuovo/manifest?k=${k}` : '/manifest.json',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    openGraph: {
      title: 'Salzillo Hospitality — il tuo accesso',
      description: 'Il tuo link personale per entrare nel gestionale. Non inoltrarlo a nessuno.',
      images: [{ url: `${SITE}/logo.png`, width: 1408, height: 774 }],
      siteName: 'Salzillo Hospitality', locale: 'it_IT', type: 'website',
    },
  };
}

const CSS = `
.en{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:28px 16px 48px;background:#F6F4F1;color:#1d1c1a;font-family:var(--font-inter),-apple-system,sans-serif;}
.en .box{max-width:460px;width:100%;}
.en .card{background:#fff;border:1px solid #E7E3DD;border-radius:18px;padding:22px 20px;margin-bottom:14px;}
.en .logo{display:block;width:100%;max-width:300px;height:auto;margin:0 auto 6px;border-radius:12px;}
.en h1{font-family:var(--font-jakarta),sans-serif;font-size:22px;font-weight:800;margin:6px 0 4px;text-align:center;}
.en h2{font-family:var(--font-jakarta),sans-serif;font-size:16px;font-weight:700;margin:0 0 8px;}
.en p{margin:6px 0;line-height:1.5;font-size:15px;}
.en .sub{color:#6b665f;font-size:14px;text-align:center;}
.en .go{display:block;text-align:center;margin:16px 0 4px;padding:15px 16px;border-radius:14px;background:#FF5A5F;color:#fff;font-weight:700;font-size:17px;text-decoration:none;}
.en ol{margin:6px 0 0;padding-left:20px;line-height:1.6;font-size:15px;}
.en li{margin:3px 0;}
.en details{border-top:1px solid #E7E3DD;padding:10px 0;}
.en details:first-of-type{border-top:none;}
.en summary{cursor:pointer;font-weight:600;font-size:15px;}
.en .nota{background:#FFF1F1;border-radius:12px;padding:10px 12px;font-size:14px;}
@media (prefers-color-scheme:dark){
  .en{background:#161513;color:#F1EEE9;}
  .en .card{background:#201E1B;border-color:#34312C;}
  .en .sub{color:#A9A39A;}
  .en details{border-color:#34312C;}
  .en .nota{background:#3a2022;}
}
`;

export default async function Entra({ searchParams }: Props) {
  const { k = '' } = await searchParams;
  const utenteId = await verificaChiaveAccesso(k);
  const [u] = utenteId ? await getDb().select({ nome: utenti.nome }).from(utenti).where(eq(utenti.id, utenteId)) : [];

  if (!u) {
    return (
      <main className="en">
        <style>{CSS}</style>
        <div className="box">
          <div className="card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/logo.png" alt="Salzillo Hospitality" />
            <h1>Questo link non è più valido</h1>
            <p className="sub">Può essere stato sostituito con uno nuovo, oppure è stato copiato a metà. Chiedi a Raffaele di mandartelo di nuovo.</p>
          </div>
        </div>
      </main>
    );
  }

  const nome = u.nome.trim().split(/\s+/)[0];
  return (
    <main className="en">
      <style>{CSS}</style>
      <div className="box">
        <div className="card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/logo.png" alt="Salzillo Hospitality" />
          <h1>Ciao {nome}</h1>
          <p className="sub">Questo è il tuo accesso personale al gestionale. Non servono username né password.</p>
          <a className="go" href={`/api/nuovo/entra?k=${k}`}>Entra →</a>
          <p className="sub">Su questo dispositivo basta farlo una volta: poi resti dentro.</p>
        </div>

        <div className="card">
          <h2>📲 Mettila sul telefono o sul computer</h2>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '4px 0 10px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="Icona dell'app: una casa bianca su sfondo corallo" width={64} height={64} style={{ borderRadius: 14, flexShrink: 0 }} />
            <p style={{ margin: 0 }}>Così la apri con un tocco, come un&apos;app, con questa icona. Fallo <b>da questa pagina</b>, prima di premere &quot;Entra&quot;.</p>
          </div>
          <details open>
            <summary>iPhone o iPad</summary>
            <ol>
              <li>Apri questa pagina con <b>Safari</b> (se sei dentro WhatsApp: tocca i tre puntini o l&apos;icona della bussola e scegli &quot;Apri in Safari&quot;).</li>
              <li>Tocca il pulsante <b>Condividi</b> (il quadrato con la freccia verso l&apos;alto).</li>
              <li>Scorri e tocca <b>Aggiungi alla schermata Home</b>, poi <b>Aggiungi</b>.</li>
            </ol>
          </details>
          <details>
            <summary>Android</summary>
            <ol>
              <li>Apri questa pagina con <b>Chrome</b>.</li>
              <li>Tocca i <b>tre puntini</b> in alto a destra.</li>
              <li>Tocca <b>Installa app</b> (oppure &quot;Aggiungi a schermata Home&quot;) e conferma.</li>
            </ol>
          </details>
          <details>
            <summary>Computer</summary>
            <ol>
              <li>Apri questa pagina con <b>Chrome</b> o <b>Edge</b>.</li>
              <li>Clicca l&apos;icona di installazione a destra nella barra dell&apos;indirizzo (un monitor con una freccia), oppure il menu ⋮ → <b>Installa Salzillo Hospitality</b>.</li>
              <li>In alternativa salva questa pagina nei preferiti (Ctrl + D).</li>
            </ol>
          </details>
        </div>

        <p className="nota">🔒 Chi ha questo link entra come te: tienilo per te e non inoltrarlo. Se pensi che l&apos;abbia visto qualcun altro, chiedi a Raffaele un link nuovo.</p>
      </div>
    </main>
  );
}
