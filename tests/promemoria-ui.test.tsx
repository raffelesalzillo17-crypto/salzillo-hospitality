import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PromemoriaBox } from '../src/app/nuovo/componenti/promemoria';
import type { Alloggio, Promemoria } from '../src/app/nuovo/tipi';

const alloggi = [{ id: 'A1', nome: 'Il Tulipano' }] as unknown as Alloggio[];
const promemoria: Promemoria = {
  aperte: [{
    id: 'T1', regolaId: 'R1', regola: 'Link ospite il giorno prima dell\'arrivo', azione: 'Messaggio ospite',
    alloggio: 'Il Tulipano', checkin: '2026-10-24', checkout: '2026-10-25', ospite: 'Carmen Rossi',
    scadenza: '2099-10-23T08:00:00.000Z', stato: 'Da fare', testo: 'Ecco tutto quello che ti serve',
    linkWhatsapp: 'https://wa.me/393331234567?text=Ciao', fattaIl: null,
  }, {
    id: 'T2', regolaId: 'R1', regola: 'Link ospite', azione: 'Messaggio ospite',
    alloggio: 'Stanza Rosa', checkin: '2026-12-23', checkout: '2026-12-24', ospite: 'Senza Telefono',
    scadenza: '2020-01-01T08:00:00.000Z', stato: 'Da fare', testo: 'Testo', linkWhatsapp: null, fattaIl: null,
  }],
  chiuse: [],
  regole: [{
    id: 'R1', nome: 'Link ospite il giorno prima dell\'arrivo', attiva: true, evento: 'Check-in', offsetGiorni: -1, ora: '10:00',
    azione: 'Messaggio ospite', modello: '{messaggio_guida}\n{emoji} {link_info}', alloggioId: null, canale: null, minNotti: null,
  }, {
    id: 'R2', nome: 'Recensione', attiva: false, evento: 'Check-out', offsetGiorni: 1, ora: '10:00',
    azione: 'Messaggio ospite', modello: 'Grazie {nome}', alloggioId: 'A1', canale: 'Airbnb', minNotti: 2,
  }],
};

describe('PromemoriaBox (disegno)', () => {
  const html = renderToString(
    <PromemoriaBox promemoria={promemoria} alloggi={alloggi} puoModificare ruoloTitolare onCambiato={async () => {}} />,
  );
  it('mostra le attività da fare con ospite, alloggio e pulsante WhatsApp', () => {
    expect(html).toContain('Carmen Rossi');
    expect(html).toContain('Il Tulipano');
    expect(html).toContain('Apri WhatsApp');
    expect(html).toContain('https://wa.me/393331234567');
  });
  it('avvisa quando manca il telefono e segna "da fare ora" se già scaduta', () => {
    expect(html).toContain('manca il numero di telefono');
    expect(html).toContain('da fare ora');
  });
  it('descrive le regole in italiano', () => {
    expect(html).toContain('1 giorno prima del check-in, alle 10:00');
    expect(html).toContain('1 giorno dopo del check-out, alle 10:00');
    expect(html).toContain('solo Il Tulipano');
    expect(html).toContain('da 2 notti');
    expect(html).toContain('disattivata');
  });
  it('il collaboratore (non titolare) non vede i comandi sulle regole', () => {
    const h = renderToString(<PromemoriaBox promemoria={promemoria} alloggi={alloggi} puoModificare ruoloTitolare={false} onCambiato={async () => {}} />);
    expect(h).not.toContain('Nuova regola');
    expect(h).not.toContain('Modifica');
  });
});
