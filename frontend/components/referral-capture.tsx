'use client';

import { useEffect } from 'react';

const REFERRAL_RE = /^[a-z0-9]{8,20}$/;

export default function ReferralCapture() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref')?.trim().toLowerCase() || '';
    if (!REFERRAL_RE.test(code)) return;
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `mg_ref=${encodeURIComponent(code)}; Max-Age=${maxAge}; Path=/; SameSite=Lax; Secure`;
    try { window.localStorage.setItem('mg_ref', code); } catch { /* cookies remain the source of truth */ }
  }, []);
  return null;
}
