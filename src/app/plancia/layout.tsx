import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Motore Rafilu',
  description: 'Il motore personale di Raffaele',
  appleWebApp: {
    title: 'Motore Rafilu',
    capable: true,
    statusBarStyle: 'black-translucent',
  },
};

export default function PlanciaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
