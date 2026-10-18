'use client';

import Link from 'next/link';
import { Clapperboard, Download } from 'lucide-react';
import { lyricVideoHref, SongResult, SongTrack } from '../lib/song-jobs';
import styles from './song-tools.module.css';

export const TRACK_COPY: Record<SongTrack, { name: string; detail: string }> = {
  voice: { name: 'Your voice', detail: 'Re-performed in the style, sung in your own voice' },
  studio: { name: 'Studio vocalist', detail: 'The same performance with a session vocalist' },
  produce: { name: 'Your take, produced', detail: 'Your original performance, cleaned, locked to the beat and mixed' },
};

export function SongTracks({ result, prompt }: { result: SongResult; prompt: string }) {
  const order: SongTrack[] = ['voice', 'studio', 'produce'];
  return <div className={styles.trackList} data-testid="song-tracks">
    {order.filter((name) => result.tracks?.[name]?.audio_url).map((name) => {
      const track = result.tracks![name]!;
      return <div key={name} className={styles.track} data-testid={`song-track-${name}`}>
        <header><b>{TRACK_COPY[name].name}</b><span>{track.duration_seconds ? `${Math.round(track.duration_seconds)}s` : ''}</span></header>
        <audio controls preload="none" src={track.audio_url} />
        <div className={styles.trackActions}>
          <a href={track.audio_url} download><Download size={14} /> MP3</a>
          {result.lyrics && <Link className={styles.video} href={lyricVideoHref(track.audio_url, result.lyrics, prompt)}>
            <Clapperboard size={14} /> Make lyric video</Link>}
        </div>
      </div>;
    })}
  </div>;
}
