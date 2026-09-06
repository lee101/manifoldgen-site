import type { Metadata } from 'next';
import Link from 'next/link';
import { Gift, Sparkles } from 'lucide-react';
import InviteDashboard from '@/components/invite-dashboard';
import { PageShell } from '@/components/seo/kit';

export const metadata: Metadata = {
  title: 'Invite Friends — Give $5, Get $5 in Generation Credits',
  description: 'Invite another creator to ManifoldGen. After their first successful purchase, you both receive $5 in AI video, image, music, and voice generation credits.',
  alternates: { canonical: '/invite' },
};

export default function InvitePage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#b99aef]/15 text-[#d8c4fb]"><Gift size={25} /></div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#cab3f3]">Creator referral credits</p>
        <h1 className="mt-4 font-display text-4xl font-700 tracking-tight md:text-6xl">Give $5. Get $5.<br />Make something ridiculous.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/68">Invite a friend to the creative AI studio where every model shares one balance. When they make their first purchase, both of you get generation credits.</p>
      </section>

      <InviteDashboard />

      <section className="mt-12 flex flex-col items-start justify-between gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center">
        <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/40"><Sparkles size={13} /> Need something worth sharing?</p><h2 className="mt-2 font-display text-xl font-700">Build a prompt, render it, then send the result.</h2></div>
        <Link href="/prompts" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black hover:bg-white/85">Open free prompt tools</Link>
      </section>
    </PageShell>
  );
}
