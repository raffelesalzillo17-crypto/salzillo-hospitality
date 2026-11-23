import { NextResponse } from 'next/server';

// Spenta il 23/11/2026 (punto 1 delle richieste di miglioramento). Era la route del vecchio sito `/`:
// non aveva alcun controllo di accesso e scriveva sul foglio Google e su Calendar, fuori dal database.
// Ora risponde 410 a qualsiasi metodo e non scrive nulla. Il codice precedente è nella storia di git
// (`git log -- src/app/api/<nome>/route.ts`). Per prenotare o cancellare si usa il gestionale /nuovo.
const RISPOSTA = {
  ok: false,
  error: 'Questa funzione del vecchio sito è stata spenta. Usa il nuovo gestionale: /nuovo',
};

const gone = () => NextResponse.json(RISPOSTA, { status: 410 });

export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const PATCH = gone;
export const DELETE = gone;
