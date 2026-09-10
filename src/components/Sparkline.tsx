'use client';

// Stessa logica dello Sparkline definito in src/app/plancia/page.tsx (non importabile da lì
// perché quel file non va toccato) — copiata qui per essere riusabile da altri componenti
// come ContabilitaDashboard.tsx.

export default function Sparkline({ values, height = 46 }: { values: number[]; height?: number }) {
  const w = 640;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1 || 1)) * w},${height - 10 - ((v - min) / range) * (height - 20)}`).join(' ');
  const last = pts.split(' ').pop()!.split(',');
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${height}`} width="100%" height={height} fill="none">
      <polyline points={pts} stroke="var(--good)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={4} fill="var(--good)" />
    </svg>
  );
}
