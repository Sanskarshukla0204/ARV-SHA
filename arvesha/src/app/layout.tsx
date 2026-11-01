import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Instrument_Sans } from 'next/font/google';
import { ConsentNotice } from '@/components/ConsentNotice';
import { siteUrl } from '@/lib/env';
import { SITE } from '@/lib/site';
import SplashScreen from '../components/splash/SplashScreen';


// The type pairing follows the logo: Cormorant Garamond matches the wordmark's letterforms,
// Instrument Sans keeps forms, prices and tables clear at small sizes.
const display = Cormorant_Garamond({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-cormorant', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-instrument', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE.name} | Online clothing store`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [...SITE.keywords],
  authors: [{ name: SITE.studio, url: SITE.studioUrl }],
  creator: SITE.studio,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/brand/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: { siteName: SITE.name, locale: SITE.locale, type: 'website', images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: SITE.name }] },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false, email: false, address: false },
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f0f1ee',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
      <body>
        <SplashScreen />
        {children}
        <ConsentNotice />
        <body className={/* keep your existing classes */}>
          <SplashScreen />   {/* add this line */}
            {children}
            </body>
      </body>
    </html>
  );
}
