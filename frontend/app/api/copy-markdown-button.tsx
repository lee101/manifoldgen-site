'use client';

import { useState } from 'react';

export function CopyMarkdownButton({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => { await navigator.clipboard.writeText(markdown); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/75 hover:text-white">{copied ? 'Copied' : 'Copy Markdown for LLMs'}</button>;
}
