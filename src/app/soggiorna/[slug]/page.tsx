import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { struttureVetrinaDb } from '@/lib/db/pubblico';
import { trovaPerSlug } from '@/lib/contenutiStrutture';
import FormRichiesta from './FormRichiesta';

export const revalidate = 300;

async function trovaStruttura(slug: string) {
  const trovato = trovaPerSlug(slug);
  if (!trovato) return null;
  const [nome, contenuto] = trovato;
  const strutture = await struttureVetrinaDb();
  const s = strutture.find((x) => x.nome === nome);
  if (!s) return null;
  return { s, contenuto };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const trovato = await trovaStruttura(slug);
  if (!trovato) return {};
  return { title: `${trovato.s.nome} — Salzillo Hospitality`, description: trovato.contenuto.tagline };
}

export default async function StrutturaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trovato = await trovaStruttura(slug);
  if (!trovato) notFound();
  const { s, contenuto } = trovato;

  return (
    <div className="min-h-screen bg-[#FAF7F3] text-[#1C1C1E]">
      <header className="border-b border-[#EFEAE3] px-6 py-5 max-w-5xl mx-auto">
        <Link href="/soggiorna" className="text-sm font-medium text-[#6E6E73] hover:text-[#FF5A5F]">
          ← Tutte le camere
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 grid md:grid-cols-[1.4fr_1fr] gap-10">
        <div>
          {contenuto.foto[0] ? (
            <div className="mb-6">
              <div className="aspect-[16/10] rounded-2xl overflow-hidden relative mb-2">
                <Image src={contenuto.foto[0]} alt={s.nome} fill className="object-cover" sizes="(max-width: 768px) 100vw, 60vw" priority />
              </div>
              {contenuto.foto.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {contenuto.foto.slice(1, 6).map((f) => (
                    <div key={f} className="aspect-square rounded-lg overflow-hidden relative">
                      <Image src={f} alt={s.nome} fill className="object-cover" sizes="120px" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[16/10] rounded-2xl bg-gradient-to-br from-[#FFE8E9] to-[#FAF7F3] flex items-center justify-center mb-6">
              <span className="text-sm text-[#6E6E73]">Foto in arrivo</span>
            </div>
          )}
          <p className="text-xs font-semibold uppercase tracking-widest text-[#FF5A5F] mb-2">
            {s.indirizzo}, {s.comune}
          </p>
          <h1 className="font-[var(--font-jakarta)] font-extrabold text-3xl mb-3 text-balance">{s.nome}</h1>
          <p className="text-lg text-[#6E6E73] mb-6">{contenuto.tagline}</p>
          <p className="leading-relaxed mb-6">{contenuto.descrizione}</p>
          <ul className="flex flex-wrap gap-2">
            {contenuto.punti.map((p) => (
              <li key={p} className="text-sm bg-white border border-[#EFEAE3] rounded-full px-3 py-1.5">
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <FormRichiesta alloggioId={s.id} nomeStruttura={s.nome} maxOspiti={contenuto.maxOspiti} />
        </div>
      </div>
    </div>
  );
}
