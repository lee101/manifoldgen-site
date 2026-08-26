import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What ManifoldGen collects, what stays private, and how your generations, wallet address, and payments are handled.',
  alternates: { canonical: '/privacy' },
};

const sections = [
  {
    heading: 'Data we collect',
    body: [
      'Account identifier. You sign in with a crypto wallet address. We store the address as your account ID.',
      'Optional credentials. If you add an email and password we store the email and a salted hash of the password — never the password itself.',
      'API key. Each account gets an API key for programmatic access. Treat it as a secret; anyone holding it can spend your credits.',
      'Billing records. Credit deposits and usage are stored as billing events (amounts, timestamps, descriptions). Card payments go through Stripe; we never receive your card number. Crypto deposits are recorded on-chain and indexed by deposit address.',
      'Generated content. Prompts, generation settings (model, seed, size), and output files for images, video, audio, and voice are stored so your library persists across sessions.',
      'Local browser storage. Your session token and API key live in localStorage on your device. Crash reports are buffered in sessionStorage and sent only when a failure occurs.',
    ],
  },
  {
    heading: 'What is public',
    body: [
      'Generated images may be included in the public gallery and search results unless they are flagged as adult content. Adult-flagged results stay in your account and never appear in public search.',
      'Prompts attached to publicly visible gallery images are visible with them. If you do not want a prompt associated with you publicly, keep the result out of the gallery or use an account without identifying details.',
      'We publish aggregate leaderboards of model benchmark results, not personal data.',
    ],
  },
  {
    heading: 'What we do not do',
    body: [
      'No third-party analytics or advertising trackers. No Google Analytics, no ad pixels, no fingerprinting scripts.',
      'No selling of personal data. There is no data broker arrangement of any kind.',
      'No email marketing. Email is used only for account recovery and essential account notices if you provided one.',
    ],
  },
  {
    heading: 'Retention and deletion',
    body: [
      'Your library is kept while your account exists so generations remain downloadable.',
      'You can delete individual generations from your account at any time; deleted files are removed from storage.',
      'To delete your entire account and associated data, contact us from the email on the account or from the linked community channel and we will process the deletion.',
    ],
  },
  {
    heading: 'Third parties',
    body: [
      'Stripe processes card payments. Stripe receives payment details directly under its own privacy policy; we receive only the payment status and identifiers.',
      'Cloudflare serves and caches this site and our static assets.',
      'Upstream AI model providers process prompts to generate outputs; they are not given your wallet address or email.',
    ],
  },
  {
    heading: 'Security',
    body: [
      'Passwords are stored only as hashes. API keys are unique per account and can be regenerated. Traffic is served over HTTPS.',
      'No system is perfectly secure. Keep your API key private and report anything suspicious.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link href="/" className="text-sm text-white/60 transition hover:text-white">
          ← Back to ManifoldGen
        </Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-white/50">Effective August 24, 2026 · manifoldgen.com</p>
        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold">{section.heading}</h2>
              <ul className="mt-4 space-y-3">
                {section.body.map((line) => (
                  <li key={line} className="flex gap-3 text-[15px] leading-7 text-white/70">
                    <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
