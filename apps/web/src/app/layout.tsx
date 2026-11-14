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
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#F4F6F9] text-slate-900 antialiased selection:bg-[#2F65F6] selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
