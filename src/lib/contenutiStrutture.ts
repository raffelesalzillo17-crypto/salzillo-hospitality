/**
 * Contenuti editoriali del sito vetrina (/soggiorna) — non stanno nel database perché
 * sono testo/marketing scritto a mano, non dati operativi. Chiave = nome esatto in `alloggi`.
 *
 * `foto` è vuoto finché Raffaele non manda le immagini reali: il sito mostra un
 * placeholder elegante invece di inventare o rubare foto da altrove.
 */
export type ContenutoStruttura = {
  slug: string;
  tagline: string;
  descrizione: string;
  punti: string[];
  foto: string[];
  maxOspiti: number;
};

export const contenutiStrutture: Record<string, ContenutoStruttura> = {
  'Il Tulipano': {
    slug: 'il-tulipano',
    tagline: 'La camera più amata, nel cuore di Marcianise',
    descrizione:
      'Camera matrimoniale con bagno privato, la struttura con più storia e più recensioni ' +
      'di Salzillo Hospitality. Ambiente curato, gestione attenta, posizione comoda per chi ' +
      'arriva a Marcianise per lavoro o per una sosta breve.',
    punti: ['Bagno privato', 'Letto matrimoniale', 'Via Clanio 60, Marcianise'],
    foto: Array.from({ length: 12 }, (_, i) => `/strutture/il-tulipano/foto-${String(i + 1).padStart(2, '0')}.jpeg`),
    maxOspiti: 3,
  },
  'Stanza Rosa': {
    slug: 'stanza-rosa',
    tagline: 'Un ambiente accogliente, a due passi dal Tulipano',
    descrizione:
      'Camera nello stesso stabile del Tulipano, in Via Clanio 60. Ideale per chi cerca ' +
      'un soggiorno semplice e diretto, con la stessa cura di sempre.',
    punti: ['Via Clanio 60, Marcianise'],
    foto: [],
    maxOspiti: 2,
  },
  'Piano Terra': {
    slug: 'piano-terra',
    tagline: 'Al piano terra, comodo e accessibile',
    descrizione:
      'Una delle camere di Via Campania 36, pensata per chi preferisce non fare scale. ' +
      'Ambiente rinnovato con toni verde salvia.',
    punti: ['Via Campania 36, Marcianise', 'Piano terra, senza scale'],
    foto: [],
    maxOspiti: 3,
  },
  'Primo Piano': {
    slug: 'primo-piano',
    tagline: 'Luminosa, al primo piano di Via Campania',
    descrizione: 'Una delle camere di Via Campania 36, luminosa e tranquilla.',
    punti: ['Via Campania 36, Marcianise'],
    foto: [],
    maxOspiti: 3,
  },
  'Secondo Piano': {
    slug: 'secondo-piano',
    tagline: 'In alto, la più silenziosa',
    descrizione: 'Una delle camere di Via Campania 36, all\'ultimo piano.',
    punti: ['Via Campania 36, Marcianise'],
    foto: [],
    maxOspiti: 3,
  },
};

export function trovaPerSlug(slug: string) {
  return Object.entries(contenutiStrutture).find(([, c]) => c.slug === slug);
}
