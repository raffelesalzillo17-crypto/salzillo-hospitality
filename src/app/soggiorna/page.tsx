import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { struttureVetrinaDb } from '@/lib/db/pubblico';
import { contenutiStrutture } from '@/lib/contenutiStrutture';

export const metadata: Metadata = {
  title: 'Salzillo Hospitality — Camere a Marcianise',
  description: 'Cinque camere a Marcianise, gestite direttamente da Raffaele. Prenota senza commissioni.',
};

export const revalidate = 300;

export default async function SoggiornaPage() {
  const strutture = await struttureVetrinaDb();

  return (
    <div className="min-h-screen bg-[#FAF7F3] text-[#1C1C1E]">
      <header className="border-b border-[#EFEAE3] px-6 py-5 flex items-center justify-between max-w-5xl mx-auto">
        <span className="font-[var(--font-jakarta)] font-extrabold text-lg tracking-tight">
          Salzillo Hospitality
        </span>
        <a
          href="https://wa.me/393522203806"
          className="text-sm font-medium text-[#FF5A5F] hover:underline"
        >
          Scrivici su WhatsApp →
        </a>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FF5A5F] mb-3">
          Marcianise, Caserta
        </p>
        <h1 className="font-[var(--font-jakarta)] font-extrabold text-4xl sm:text-5xl leading-[1.05] mb-5 text-balance">
          Cinque camere, una sola famiglia che le gestisce
        </h1>
        <p className="text-lg text-[#6E6E73] max-w-2xl leading-relaxed">
          Prenotando qui direttamente — senza passare da Airbnb o Booking — risparmi tu, e noi
          possiamo dedicarti più attenzione. Scrivici, ti rispondiamo con disponibilità e prezzo
          in poco tempo.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid sm:grid-cols-2 gap-5">
          {strutture.map((s) => {
            const c = contenutiStrutture[s.nome];
            if (!c) return null;
            return (
              <Link
                key={s.id}
                href={`/soggiorna/${c.slug}`}
                className="group block rounded-2xl border border-[#EFEAE3] bg-white overflow-hidden hover:border-[#FF5A5F] transition-colors"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-[#FFE8E9] to-[#FAF7F3] flex items-center justify-center relative overflow-hidden">
                  {c.foto[0] ? (
                    <Image src={c.foto[0]} alt={s.nome} fill className="object-cover" sizes="(max-width: 640px) 100vw, 50vw" />
                  ) : (
                    <span className="text-sm text-[#6E6E73]">Foto in arrivo</span>
                  )}
                </div>
                <div className="p-5">
                  <h2 className="font-[var(--font-jakarta)] font-bold text-lg mb-1">{s.nome}</h2>
                  <p className="text-sm text-[#6E6E73] mb-3">{c.tagline}</p>
                  <span className="text-sm font-semibold text-[#FF5A5F] group-hover:underline">
                    Vedi disponibilità →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-[#EFEAE3] px-6 py-8 text-center text-sm text-[#6E6E73]">
        Marcianise (CE) · Salzillo Hospitality
      </footer>
    </div>
  );
}
