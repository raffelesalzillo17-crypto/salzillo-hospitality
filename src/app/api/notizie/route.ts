import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const FEEDS = [
  { url: 'https://www.ansa.it/sito/ansait_rss.xml', source: 'ANSA' },
  { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
  { url: 'https://www.ilsole24ore.com/rss/economia.xml', source: 'Il Sole 24 Ore' },
];

const parser = new Parser();

export async function GET() {
  try {
    const perFeed = await Promise.all(
      FEEDS.map(async (feed) => {
        try {
          const parsed = await parser.parseURL(feed.url);
          return (parsed.items || []).slice(0, 5).map((item) => ({
            source: feed.source,
            title: item.title || '',
            link: item.link || '',
            snippet: (item.contentSnippet || item.content || '').slice(0, 220),
            pubDate: item.pubDate || '',
          }));
        } catch {
          return [];
        }
      })
    );
    return NextResponse.json({ ok: true, news: perFeed.flat() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
