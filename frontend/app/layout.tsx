import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import './globals.css';
import PaymentProvider from '../components/payment-provider';

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
const socialImage = '/brand/manifoldgen-og.webp';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'ManifoldGen',
  title: {
    default: 'ManifoldGen | AI Video Creator and Generator',
    template: '%s | ManifoldGen',
  },
  description:
    'Create AI video from text, images, and reference media with ManifoldGen, an AI video creator for cinematic generation, audio, and editing.',
  keywords: [
    'AI video',
    'AI video creator',
    'AI video generator',
    'AI video maker',
    'create AI video',
    'text to video AI',
    'image to video AI',
    'text to video',
    'cinematic video generator',
    'video generation',
    'generative video',
    'ManifoldGen',
    'H3 video',
    'manifoldgen',
    'omniserve',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'ManifoldGen',
    title: 'ManifoldGen | AI Video Creator and Generator',
    description: 'Create cinematic AI video from text, images, and reference media.',
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: 'Cinematic video creation with ManifoldGen',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ManifoldGen | AI Video Creator and Generator',
    description: 'Create cinematic AI video from text, images, and reference media.',
    images: [socialImage],
  },
  icons: {
    icon: [
      { url: '/images/favicon.webp', type: 'image/webp', sizes: '64x64' },
      { url: '/images/favicon-32.webp', type: 'image/webp', sizes: '32x32' },
    ],
    apple: [{ url: '/images/apple-touch-icon.webp', sizes: '180x180' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ManifoldGen',
    url: siteUrl,
    description: 'A web-based AI video creator for generating and editing cinematic video from text prompts, images, and reference media.',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
  };

  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} dark`}>
      <body className="min-h-screen antialiased">
        <PaymentProvider>{children}</PaymentProvider>
        <footer className="border-t border-white/10 bg-[#0a0910] px-5 py-6 text-center text-sm text-white/50">
          <a
            href="https://manifoldgan.evangeler.com"
            className="font-medium text-white/65 transition hover:text-white"
          >
            Affiliate program
          </a>
        </footer>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
