'use client';

import { useEffect, useState } from 'react';
import AnimeControlTool from '../anime-control/AnimeControlTool';

export default function PosePuppet() {
  const [pose, setPose] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const m = /(?:^#|&)pose=([^&]+)/.exec(window.location.hash);
    if (m) { try { setPose(decodeURIComponent(m[1])); } catch { /* ignore a malformed link */ } }
    setReady(true);
  }, []);
  if (!ready) return null;
  return <AnimeControlTool tool="scene" initialPose={pose} />;
}
