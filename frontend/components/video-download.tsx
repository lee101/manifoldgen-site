'use client';

import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { downloadVideo, videoExtension, type VideoExportFormat } from '../lib/video-export';

type Props = {
  url: string;
  name?: string;
  className?: string;
  testId?: string;
};

const DEFAULT_CLASS = 'inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/75 hover:text-white disabled:opacity-60';

export default function VideoDownload({ url, name = 'manifoldgen-video', className = DEFAULT_CLASS, testId = 'video-download' }: Props) {
  const [busy, setBusy] = useState<VideoExportFormat | ''>('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const extension = videoExtension(url);
  const compact = extension === 'webm' || extension === 'mkv';

  async function run(format: VideoExportFormat) {
    setBusy(format); setProgress(0); setError('');
    try {
      await downloadVideo(url, name, format, setProgress);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Download failed');
    } finally {
      setBusy('');
    }
  }

  const spinner = <LoaderCircle size={14} className="animate-spin" />;
  return <div className="flex flex-wrap items-center gap-2" data-testid={testId}>
    {compact && <button type="button" className={className} disabled={Boolean(busy)} data-testid={`${testId}-original`} onClick={() => void run('original')}>
      {busy === 'original' ? spinner : <Download size={14} />} Download WebM
    </button>}
    <button type="button" className={className} disabled={Boolean(busy)} data-testid={`${testId}-mp4`} onClick={() => void run('mp4')}>
      {busy === 'mp4' ? spinner : <Download size={14} />}
      {busy === 'mp4' ? `Converting ${Math.round(progress * 100)}%` : 'Download MP4'}
    </button>
    {compact && !busy && !error && <small className="text-xs text-white/45">MP4 is converted on your device</small>}
    {error && <small role="alert" className="text-xs text-red-300">{error}</small>}
  </div>;
}
