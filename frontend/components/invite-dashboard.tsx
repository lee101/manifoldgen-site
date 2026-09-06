'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, Gift, Loader2, Share2, Users } from 'lucide-react';
import { loadStoredUser } from '@/lib/auth';

type ReferralData = {
  code: string;
  invite_url: string;
  joined: number;
  rewarded: number;
  earned_usd: number;
  reward_usd: number;
};

export default function InviteDashboard() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const user = loadStoredUser();
    if (!user?.api_key) { setSignedOut(true); setLoading(false); return; }
    fetch('/api/referrals', { headers: { Authorization: `Bearer ${user.api_key}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again to load your invite link.' : 'Could not load referrals.');
        return response.json() as Promise<ReferralData>;
      })
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load referrals.'))
      .finally(() => setLoading(false));
  }, []);

  async function copyLink() {
    if (!data) return;
    await navigator.clipboard.writeText(data.invite_url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function shareLink() {
    if (!data) return;
    const share = { title: 'Create with every AI model in one studio', text: 'I use ManifoldGen for AI video, image, music, and voice. This link gives us both $5 in generation credits after your first purchase.', url: data.invite_url };
    if (navigator.share) await navigator.share(share);
    else await copyLink();
  }

  if (loading) return <div className="mt-10 flex min-h-64 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] text-white/50"><Loader2 className="mr-3 animate-spin" size={18} /> Building your invite link…</div>;
  if (signedOut) return (
    <section className="mt-10 rounded-3xl border border-[#b99aef]/25 bg-[#b99aef]/[0.07] p-7 md:p-9">
      <Gift size={28} className="text-[#d8c4fb]" />
      <h2 className="mt-5 font-display text-2xl font-700">Sign in to get your personal link</h2>
      <p className="mt-3 max-w-xl text-sm leading-7 text-white/60">Your link tracks friends who join. When a friend makes their first purchase, both accounts receive $5 in generation credits.</p>
      <Link href="/account" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black hover:bg-white/85">Sign in or create an account <ArrowRight size={15} /></Link>
    </section>
  );
  if (error || !data) return <div role="alert" className="mt-10 rounded-2xl border border-red-300/15 bg-red-400/[0.06] p-5 text-sm text-red-100/75">{error || 'Could not load your referral link.'}</div>;

  return (
    <>
      <section className="mt-10 overflow-hidden rounded-3xl border border-[#b99aef]/25 bg-[linear-gradient(145deg,rgba(185,154,239,.12),rgba(255,255,255,.025)_52%,rgba(55,214,197,.06))]">
        <div className="p-6 md:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#cab3f3]">Your personal invite link</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white/72">{data.invite_url}</code>
            <button type="button" onClick={() => void copyLink()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold hover:border-white/40">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy link'}</button>
            <button type="button" onClick={() => void shareLink()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black hover:bg-white/85"><Share2 size={16} /> Share</button>
          </div>
          <p className="mt-4 text-xs leading-6 text-white/42">Referral code: <strong className="text-white/65">{data.code}</strong> · Rewards unlock after the invited creator’s first successful purchase.</p>
        </div>
        <div className="grid border-t border-white/10 sm:grid-cols-3">
          {[
            { label: 'Friends joined', value: data.joined, icon: Users },
            { label: 'Rewards unlocked', value: data.rewarded, icon: Gift },
            { label: 'Credits earned', value: `$${data.earned_usd.toFixed(2)}`, icon: Check },
          ].map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center gap-4 border-b border-white/10 px-6 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><Icon size={17} className="text-[#cab3f3]" /><span className="grid"><b className="text-xl">{value}</b><small className="text-xs text-white/42">{label}</small></span></div>)}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ['1', 'Send your link', 'Share it with AI filmmakers, designers, developers, or anyone paying for too many separate creative tools.'],
          ['2', 'They create and buy', 'The link is remembered for 30 days. Their account is attributed only if it is genuinely new.'],
          ['3', 'You both get $5', 'After their first successful purchase, each account receives $5 in generation credits automatically.'],
        ].map(([number, title, copy]) => <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><span className="font-display text-3xl font-700 text-white/15">0{number}</span><h3 className="mt-1 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/55">{copy}</p></div>)}
      </section>
    </>
  );
}
