import { NextResponse } from 'next/server';

const SYMBOLS = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^IXIC', label: 'Nasdaq' },
  { symbol: 'FTSEMIB.MI', label: 'FTSE MIB' },
  { symbol: 'EURUSD=X', label: 'EUR/USD' },
  { symbol: 'EUNL.DE', label: 'PAC — iShares Core MSCI World' },
];

async function fetchQuote(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const meta = data.chart.result[0].meta;
  const closes: number[] = (data.chart.result[0].indicators?.quote?.[0]?.close || []).filter((v: number | null) => v != null);
  return {
    price: meta.regularMarketPrice,
    changePercent: meta.regularMarketChangePercent,
    currency: meta.currency,
    spark: closes.slice(-20),
  };
}

export async function GET() {
  const markets = await Promise.all(
    SYMBOLS.map(async ({ symbol, label }) => {
      try {
        const q = await fetchQuote(symbol);
        return { label, ...q };
      } catch {
        return { label, error: true };
      }
    })
  );
  return NextResponse.json({ ok: true, markets });
}
