import { NextRequest, NextResponse } from 'next/server';

// Manifest dell'app installata a partire dal link personale (/entra?k=...). È uguale a
// public/manifest.json tranne l'indirizzo di partenza, che passa da /api/nuovo/entra con la
// chiave: l'app installata apre da sola la sessione a ogni avvio, anche dove (iPhone) l'app
// sulla schermata Home non condivide i dati di accesso con il browser. Non controlla la chiave:
// lo fa /api/nuovo/entra quando l'app parte.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get('k') || '';
  const valida = /^[A-Za-z0-9_-]{40,}$/.test(k);
  return NextResponse.json({
    name: 'Salzillo Hospitality',
    short_name: 'Hospitality',
    description: 'Gestione prenotazioni Salzillo Hospitality',
    id: '/nuovo',
    start_url: valida ? `/api/nuovo/entra?k=${k}` : '/nuovo',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#161513',
    theme_color: '#FF5A5F',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } });
}
