'use client';
import { useState } from 'react';

export default function FormRichiesta({ alloggioId, nomeStruttura, maxOspiti }: { alloggioId: string; nomeStruttura: string; maxOspiti: number }) {
  const [stato, setStato] = useState<'form' | 'inviando' | 'ok' | 'errore'>('form');
  const [errore, setErrore] = useState('');

  async function inviaRichiesta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStato('inviando');
    const f = new FormData(e.currentTarget);
    const res = await fetch('/api/pubblico/richiesta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alloggioId,
        nomeStruttura,
        checkin: f.get('checkin'),
        checkout: f.get('checkout'),
        numeroOspiti: f.get('numeroOspiti'),
        nome: f.get('nome'),
        telefono: f.get('telefono'),
        note: f.get('note'),
      }),
    });
    if (res.ok) {
      setStato('ok');
    } else {
      const j = await res.json().catch(() => ({}));
      setErrore(j.error || 'Qualcosa non ha funzionato.');
      setStato('errore');
    }
  }

  if (stato === 'ok') {
    return (
      <div className="rounded-2xl border border-[#EFEAE3] bg-white p-6 text-center">
        <p className="font-semibold mb-1">Richiesta inviata ✓</p>
        <p className="text-sm text-[#6E6E73]">
          Ti risponderemo a breve con disponibilità e prezzo. Se preferisci, scrivici anche su
          WhatsApp per una risposta più rapida.
        </p>
        <a href="https://wa.me/393522203806" className="inline-block mt-4 text-sm font-semibold text-[#FF5A5F] hover:underline">
          Apri WhatsApp →
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={inviaRichiesta} className="rounded-2xl border border-[#EFEAE3] bg-white p-6 space-y-4">
      <h3 className="font-[var(--font-jakarta)] font-bold text-lg">Richiedi disponibilità</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-[#6E6E73]">Dal</span>
          <input type="date" name="checkin" required className="w-full rounded-lg border border-[#EFEAE3] px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="block mb-1 text-[#6E6E73]">Al</span>
          <input type="date" name="checkout" required className="w-full rounded-lg border border-[#EFEAE3] px-3 py-2" />
        </label>
      </div>
      <label className="text-sm block">
        <span className="block mb-1 text-[#6E6E73]">Ospiti (massimo {maxOspiti})</span>
        <input
          type="number" name="numeroOspiti" min={1} max={maxOspiti}
          defaultValue={Math.min(2, maxOspiti)} required
          className="w-full rounded-lg border border-[#EFEAE3] px-3 py-2"
        />
      </label>
      <label className="text-sm block">
        <span className="block mb-1 text-[#6E6E73]">Nome e cognome</span>
        <input type="text" name="nome" required className="w-full rounded-lg border border-[#EFEAE3] px-3 py-2" />
      </label>
      <label className="text-sm block">
        <span className="block mb-1 text-[#6E6E73]">Telefono (anche WhatsApp)</span>
        <input type="tel" name="telefono" required className="w-full rounded-lg border border-[#EFEAE3] px-3 py-2" />
      </label>
      <label className="text-sm block">
        <span className="block mb-1 text-[#6E6E73]">Note (facoltativo)</span>
        <textarea name="note" rows={2} className="w-full rounded-lg border border-[#EFEAE3] px-3 py-2" />
      </label>
      {stato === 'errore' && <p className="text-sm text-red-600">{errore}</p>}
      <button
        type="submit"
        disabled={stato === 'inviando'}
        className="w-full rounded-lg bg-[#FF5A5F] text-white font-semibold py-2.5 hover:bg-[#E64A50] disabled:opacity-60"
      >
        {stato === 'inviando' ? 'Invio…' : 'Richiedi disponibilità'}
      </button>
      <p className="text-xs text-[#6E6E73] text-center">
        Non è una prenotazione confermata: ti scriveremo noi per finalizzare.
      </p>
    </form>
  );
}
