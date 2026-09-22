import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowUpRight } from 'lucide-react';
import ToolsIndex from './ToolsIndex';
import { tools } from '@/lib/tools-catalog';
import { VIDEO_GENERATORS } from '@/lib/video-generators';
import styles from './page.module.css';

export const metadata = {
  title: 'AI Creative Tools — ManifoldGen',
  description: 'Purpose-built spaces for AI art, image editing, relighting, upscaling, character animation, music, and video finishing.',
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
    <ToolsIndex tools={tools} />
    <section className={styles.videoStrip}>
      <p>VIDEO GENERATORS</p>
      {videoFamilies.map(({ family, toolHref, toolName, accent }) => (
        <Link key={family} href={toolHref} className={styles.videoChip} style={{ '--chip-accent': accent } as CSSProperties} title={toolName}>
          {family}
        </Link>
      ))}
      <Link href="/api/video-generators" className={styles.videoStripAll}>All <ArrowUpRight size={13} /></Link>
    </section>
  </main>;
}
