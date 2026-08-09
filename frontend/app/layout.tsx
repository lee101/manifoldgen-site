import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const siteUrl = 'https://manifoldgen.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'ManifoldGen — AI Video Studio',
    template: '%s | ManifoldGen',
  },
  description:
    'Generate cinematic AI video in multiple resolutions. Dark studio UX, pay-as-you-go H3 pricing, Stripe subscriptions.',
  keywords: [
    'AI video',
    'text to video',
    'H3 video',
    'manifoldgen',
    'omniserve',
  ],
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'ManifoldGen',
    title: 'ManifoldGen — AI Video Studio',
    description: 'Full-bleed AI video generation. Sign up, prompt, render.',
    images: [
      {
        url: 'https://manifoldgenstatic.manifoldgen.com/static/brand/logo.webp',
        width: 1024,
        height: 1024,
        alt: 'ManifoldGen',
      },
    ],
  },
  icons: {
    icon: [
      { url: '/images/favicon.webp', type: 'image/webp', sizes: '64x64' },
      { url: '/brand/logo-mark.webp', type: 'image/webp', sizes: '512x512' },
    ],
    apple: [{ url: '/images/apple-touch-icon.webp', sizes: '180x180' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} dark`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
