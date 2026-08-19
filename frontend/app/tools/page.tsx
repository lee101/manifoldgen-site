import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, Sparkles } from 'lucide-react';
import styles from './page.module.css';

const tools = [
  { href: '/tool/anima', name: 'Anima Art Studio', label: 'CHARACTER ART', copy: 'Anime-native character design and polished illustration.', kind: 'image', src: '/examples/anima/celestial-cartographer.png', meta: 'Anima-2.9B · seed 18467291' },
  { href: '/tools/h3-image', name: 'H3 Image', label: 'TEXT TO IMAGE', copy: 'High-detail finished frames from the H3 visual world model.', kind: 'image', src: 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/h3_dev_glass_hummingbird_20260816.png', meta: 'MiniMax H3 · real generation' },
  { href: '/tools/h3-image-editor', name: 'H3 Image Editor', label: 'REFERENCE EDIT', copy: 'Regenerate a source while preserving identity and geometry.', kind: 'image', src: 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/h3_dev_glass_hummingbird_greenhouse_20260816.png', meta: 'H3 REF2VA · real edit' },
  { href: '/tools/character-animator', name: 'Character Animator', label: 'IMAGE + MOTION', copy: 'Transfer body movement, expression, and timing from a driving clip.', kind: 'video', src: 'https://manifoldgenstatic.manifoldgen.com/gallery/videos/wan_animate_cartographer_standard_5s_20260816.mp4', meta: 'Wan Animate 2 · real 5s Standard output' },
  { href: '/tools/video-background-remover', name: 'Video Background Remover', label: 'VIDEO UTILITY', copy: 'Create a transparent foreground while retaining original pixels.', kind: 'video', src: 'https://manifoldgenstatic.manifoldgen.com/gallery/service_netw/video-background/6f378c9b-1c0d-4aad-9f1a-e41f9436fca5.webm', meta: 'RVM · real transparent output' },
  { href: '/tools/music-generator', name: 'Song Generator', label: 'MUSIC', copy: 'Full songs with vocals and instrumental from a caption and your lyrics.', kind: 'audio', src: 'https://manifoldgenstatic.manifoldgen.com/gallery/originals/h3_dev_glass_hummingbird_20260816.png', meta: 'MiniMax-Music3 · 32 kHz stereo' },
] as const;

export const metadata = {
  title: 'AI Creative Tools — ManifoldGen',
  description: 'Purpose-built spaces for AI art, image editing, character animation, and video finishing.',
};

export default function ToolsPage() {
  return <main className={styles.page}>
    <header><Link href="/"><ArrowLeft size={16} /> ManifoldGen</Link><span><Sparkles size={13} /> CREATIVE SPACES</span><Link href="/account">Account</Link></header>
    <section className={styles.intro}><p>TOOLS / 05</p><h1>One focused space<br />for every creative job.</h1><span>Every card below shows a real output from the tool—not a stock placeholder.</span></section>
    <section className={styles.grid}>{tools.map((tool, index) => <Link key={tool.href} href={tool.href} className={`${styles.card} ${index === 0 ? styles.featured : ''}`}>
      <div className={styles.media}>{tool.kind === 'video' ? <video src={tool.src} muted autoPlay loop playsInline /> : <img src={tool.src} alt={`${tool.name} real output`} />}
        <span className={styles.real}><Check size={11} /> REAL OUTPUT</span>
      </div>
      <div className={styles.copy}><small>{tool.label}</small><h2>{tool.name}</h2><p>{tool.copy}</p><footer><span>{tool.meta}</span><ArrowUpRight size={18} /></footer></div>
    </Link>)}</section>
  </main>;
}
