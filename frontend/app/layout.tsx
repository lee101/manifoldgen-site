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
const socialImage = '/brand/manifoldgen-og.webp';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'ManifoldGen',
  title: {
    default: 'ManifoldGen — AI Video Generator',
    template: '%s | ManifoldGen',
  },
  description:
    'Create cinematic AI video from a text prompt. Control aspect ratio, duration, quality, and audio in one fast video studio.',
  keywords: [
    'AI video',
    'AI video generator',
    'text to video',
    'cinematic video generator',
    'video generation',
    'generative video',
    'ManifoldGen',
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
    title: 'ManifoldGen — AI Video Generator',
    description: 'Turn a prompt into cinematic AI video.',
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
    title: 'ManifoldGen — AI Video Generator',
    description: 'Turn a prompt into cinematic AI video.',
    images: [socialImage],
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
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ManifoldGen',
    url: siteUrl,
    description: 'A web-based AI video generator for creating cinematic video from text prompts.',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
  };

  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} dark`}>
      <head>
        <link rel="preload" as="image" href={socialImage} type="image/webp" />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
