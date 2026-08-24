import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowUpRight, Sparkles } from 'lucide-react';
import ToolsIndex from './ToolsIndex';
import { tools } from '@/lib/tools-catalog';
import { VIDEO_GENERATORS } from '@/lib/video-generators';
import styles from './page.module.css';

export const metadata = {
  title: 'AI Creative Tools — ManifoldGen',
  description: 'Purpose-built spaces for AI art, image editing, relighting, upscaling, character animation, and video finishing.',
};

const FAMILIES = ['Kling', 'Veo', 'Seedance', 'Wan', 'LTX', 'Manifold', 'Happy Horse', 'RA2V'];

export default function ToolsPage() {
  const videoFamilies = FAMILIES
    .map((family) => {
      const generator = VIDEO_GENERATORS.find((entry) => entry.family === family);
      return generator ? { family, toolHref: `/tools/${generator.slug}`, toolName: generator.name, accent: generator.accent } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return <main className={styles.page}>
    <header><Link href="/"><ArrowLeft size={16} /> ManifoldGen</Link><span><Sparkles size={13} /> CREATIVE SPACES</span><Link href="/account">Account</Link></header>
    <ToolsIndex tools={tools} />
    <section className={styles.videoStrip}>
      <div className={styles.videoStripHead}>
        <p>VIDEO GENERATORS</p>
        <Link href="/api/video-generators" className={styles.videoStripAll}>All generators <ArrowUpRight size={14} /></Link>
      </div>
      <div className={styles.videoStripGrid}>
        {videoFamilies.map(({ family, toolHref, toolName, accent }) => (
          <Link key={family} href={toolHref} className={styles.videoChip} style={{ '--chip-accent': accent } as CSSProperties}>
            <span>{family}</span>
            <small>{toolName}</small>
          </Link>
        ))}
      </div>
    </section>
  </main>;
}
