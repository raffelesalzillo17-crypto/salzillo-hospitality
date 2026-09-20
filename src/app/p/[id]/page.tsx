import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { preventivoPubblico } from '@/lib/db/queries';

// Pagina pubblica del preventivo, pensata per essere condivisa su WhatsApp: link corto
// (/p/<uuid>, non enumerabile — stessa idea del vecchio link diretto al PDF, solo più
// presentabile), anteprima con il brand di Salzillo Hospitality invece del PDF nudo, e un
// bottone per scaricarlo. Il PDF vero resta generato al volo da /api/nuovo/documento.
const SITE = 'https://salzillo-hospitality.vercel.app';
const eur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const dataIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

async function trova(id: string) {
  const p = await preventivoPubblico(id);
  if (!p) return null;
  const notti = Math.round((Date.parse(p.checkout) - Date.parse(p.checkin)) / 864e5);
  return { ...p, notti };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await trova(id);
  if (!p) return { title: 'Preventivo — Salzillo Hospitality' };
  return {
    title: `Preventivo ${p.codice} — Salzillo Hospitality`,
    description: `${p.alloggio}, ${p.notti} nott${p.notti === 1 ? 'e' : 'i'} · Totale ${eur(Number(p.totale))}`,
    openGraph: {
      title: `Preventivo ${p.codice} — Salzillo Hospitality`,
      description: `${p.alloggio} · ${dataIt(p.checkin)} → ${dataIt(p.checkout)} · Totale ${eur(Number(p.totale))}`,
      images: [{ url: `${SITE}/logo.png`, width: 1408, height: 774 }],
      siteName: 'Salzillo Hospitality',
      locale: 'it_IT',
      type: 'website',
    },
  };
}

export default async function PaginaPreventivo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await trova(id);
  if (!p) notFound();

  const pdfUrl = `/api/nuovo/documento?tipo=preventivo&id=${id}`;
  const scontoNum = Number(p.sconto);
  const scaduto = p.stato === 'Scaduto' || p.stato === 'Rifiutato';

  return (
    <div className="min-h-screen bg-[#FAF7F3] text-[#1C1C1E] flex flex-col">
      <header className="border-b border-[#EFEAE3] px-6 py-5 flex items-center justify-between max-w-2xl mx-auto w-full">
        <span className="font-[var(--font-jakarta)] font-extrabold text-lg tracking-tight">
          Salzillo Hospitality
        </span>
        <a href="https://wa.me/393522203806" className="text-sm font-medium text-[#FF5A5F] hover:underline">
          Scrivici su WhatsApp →
        </a>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FF5A5F] mb-3">
          Preventivo {p.codice}
        </p>
        <h1 className="font-[var(--font-jakarta)] font-extrabold text-3xl sm:text-4xl leading-[1.1] mb-6 text-balance">
          {p.ospiteNome ? `Ciao ${p.ospiteNome}, ecco` : 'Ecco'} il tuo soggiorno da noi
        </h1>

        <div className="rounded-2xl border border-[#EFEAE3] bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6E6E73]">Alloggio</span>
            <span className="font-semibold">{p.alloggio}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6E6E73]">Check-in → Check-out</span>
            <span className="font-semibold">{dataIt(p.checkin)} → {dataIt(p.checkout)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6E6E73]">Notti · Ospiti</span>
            <span className="font-semibold">{p.notti} · {p.numeroOspiti}</span>
          </div>
          {scontoNum > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6E6E73]">Sconto</span>
              <span className="font-semibold text-[#1FAA6E]">−{eur(scontoNum)}</span>
            </div>
          )}
          <div className="pt-4 border-t border-[#EFEAE3] flex items-center justify-between">
            <span className="text-base font-semibold">Totale</span>
            <span className="text-2xl font-extrabold text-[#FF5A5F]">{eur(Number(p.totale))}</span>
          </div>
        </div>

        {scaduto ? (
          <p className="mt-5 text-sm text-[#6E6E73]">
            Questo preventivo non è più valido — scrivici su WhatsApp se vuoi uno aggiornato.
          </p>
        ) : (
          <p className="mt-5 text-sm text-[#6E6E73]">
            Le date restano riservate per te per {p.validoOre} ore. Cancellazione gratuita fino a 48h prima del check-in.
          </p>
        )}

        <a href={pdfUrl} target="_blank" rel="noopener"
          className="mt-6 inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-[#FF5A5F] text-white font-semibold px-6 py-3 hover:bg-[#E64A50] transition-colors">
          📄 Apri il PDF completo
        </a>
      </main>

      <footer className="border-t border-[#EFEAE3] px-6 py-8 text-center text-sm text-[#6E6E73]">
        {p.immobile} · {p.comune} · Salzillo Hospitality
      </footer>
    </div>
  );
}
