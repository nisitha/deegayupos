import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'PixelCraft POS | Enterprise Multi-Tenant Platform',
  description:
    'PixelCraft POS (pos.pixelcraftlk.com) - Enterprise-grade Multi-Tenant SaaS platform engineered by PixelCraft LK.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-[#080C14] text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
