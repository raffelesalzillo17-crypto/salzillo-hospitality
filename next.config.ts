import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/assistente': ['./data/wiki/**/*'],
    '/api/telegram-webhook': ['./data/wiki/**/*'],
    '/api/cron/digest': ['./data/wiki/**/*'],
    '/api/cron/report-notturno': ['./data/report-notturno.md'],
  },
};

export default nextConfig;
