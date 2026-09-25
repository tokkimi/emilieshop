import type { Metadata } from 'next';
import { Geist, Geist_Mono, Playfair_Display } from 'next/font/google';
import './globals.css';
import './premium.css';
import { ScrollToTop } from './components/ScrollToTop';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const playfair = Playfair_Display({
  variable: '--font-display',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://memoiremaison.com'),
  manifest: '/manifest.webmanifest',
  title: 'Mémoire Maison — Chaque maison a une histoire',
  description: 'Créez un livre souvenir personnalisé de votre maison, à partir de vos photos, de vos mots et de votre voix.',
  icons: {
    icon: [{ url: '/favicon.ico', sizes: '48x48' }, { url: '/favicon.png', type: 'image/png', sizes: '64x64' }, { url: '/icon-192.png', type: 'image/png', sizes: '192x192' }],
    apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  alternates: { canonical: '/', languages: { 'fr-CA': '/', 'en-CA': '/en' } },
  openGraph: {
    type: 'website',
    locale: 'fr_CA',
    alternateLocale: ['en_CA'],
    title: 'Mémoire Maison — Chaque maison a une histoire',
    description: 'Créez un livre souvenir personnalisé à partir de vos photos, de vos mots et de votre voix.',
    images: [{ url: '/og.png', width: 1730, height: 909, alt: 'Mémoire Maison — Chaque maison a une histoire' }],
  },
  twitter: { card: 'summary_large_image', title: 'Mémoire Maison', description: 'Chaque maison a une histoire.', images: ['/og.png'] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased`}
      >
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
