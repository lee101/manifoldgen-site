'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gift, Users } from 'lucide-react';

export default function InviteFriendsPill() {
  const pathname = usePathname();
  if (pathname === '/invite' || pathname.startsWith('/studio')) return null;
  return (
    <Link
      href="/invite"
      className="group fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-2xl border border-[#cab3f3]/30 bg-[#171321]/92 px-4 py-3 text-white shadow-[0_16px_50px_rgba(0,0,0,.4)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#cab3f3]/60 sm:bottom-6 sm:right-6"
      aria-label="Invite friends and earn generation credits"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#b99aef]/15 text-[#d8c4fb]"><Gift size={18} /></span>
      <span className="grid leading-tight">
        <b className="text-sm">Give $5, get $5</b>
        <small className="mt-1 flex items-center gap-1 text-[11px] text-white/48"><Users size={11} /> Invite a creator</small>
      </span>
    </Link>
  );
}
