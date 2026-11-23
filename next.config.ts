import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Il vecchio sito sulla root è dismesso (23/11/2026): redirect permanente al gestionale.
  async redirects() {
    return [{ source: '/', destination: '/nuovo', statusCode: 301 }];
  },
  outputFileTracingIncludes: {
    '/api/assistente': ['./data/wiki/**/*'],
    '/api/telegram-webhook': ['./data/wiki/**/*'],
    '/api/cron/digest': ['./data/wiki/**/*'],
    '/api/cron/report-notturno': ['./data/report-notturno.md'],
  },
};

export default nextConfig;
