import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/assistente': ['./data/wiki/**/*'],
    '/api/telegram-webhook': ['./data/wiki/**/*'],
    '/api/cron/digest': ['./data/wiki/**/*'],
  },
};

export default nextConfig;
