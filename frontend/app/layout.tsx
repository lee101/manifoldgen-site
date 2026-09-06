import type { Metadata } from 'next';
import { Bebas_Neue, Cormorant_Garamond, DM_Sans, IBM_Plex_Mono, Playfair_Display, Space_Grotesk, Syne } from 'next/font/google';
import './globals.css';
import PaymentProvider from '../components/payment-provider';
import SiteFooter from '../components/site-footer';
import InviteFriendsPill from '../components/invite-friends-pill';
import ReferralCapture from '../components/referral-capture';

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

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', weight: ['400', '500', '600', '700'], display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', weight: ['400', '600', '800'], display: 'swap' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], variable: '--font-cormorant', weight: ['400', '600', '700'], display: 'swap' });
const bebas = Bebas_Neue({ subsets: ['latin'], variable: '--font-bebas', weight: '400', display: 'swap' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-ibm-plex-mono', weight: ['400', '600'], display: 'swap' });

const siteUrl = 'https://manifoldgen.com';
const socialImage = '/brand/manifoldgen-og.webp';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'ManifoldGen',
  title: {
    default: 'ManifoldGen | Every Creative AI Model. One Balance.',
    template: '%s | ManifoldGen',
  },
  description:
    'One creative AI studio for video, images, music, voice, editing, and API access. Run every leading model with one account and one balance.',
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
    title: 'ManifoldGen | Every Creative AI Model. One Balance.',
    description: 'Video, images, music, voice, editing, and API access in one creative AI studio.',
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
    title: 'ManifoldGen | Every Creative AI Model. One Balance.',
    description: 'Video, images, music, voice, editing, and API access in one creative AI studio.',
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
    description: 'A creative AI studio for generating and editing video, images, music, and voice across leading models with one balance.',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
  };

  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${spaceGrotesk.variable} ${playfair.variable} ${cormorant.variable} ${bebas.variable} ${ibmPlexMono.variable} dark`}>
      <body className="min-h-screen antialiased">
        <ReferralCapture />
        <PaymentProvider>{children}</PaymentProvider>
        <InviteFriendsPill />
        <SiteFooter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
