import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { JsonLd, toolJsonLd } from '@/components/seo/kit';
import { MCP_SETUP, MOTION_TOOLS, PRODUCTION_SUITE, PRODUCTION_TOOLS } from '@/lib/production-tools';
import styles from '@/components/production/production.module.css';

export const metadata: Metadata = {
  title: 'Production Suite: Hosted Blender, 3D, Vector and Cleanup Tools — ManifoldGen',
  description: 'Destruction sims, exploded views, toon shading, remote Blender scenes, image to 3D, vectorize and shot cleanup. Editable outputs, one API and an MCP server for agents.',
  alternates: { canonical: '/tools/production' },
};

const prompts = ['production-bundle', 'destruction-studio', 'exploded-view', 'scene-builder', 'toon-shader', 'shot-cleanup', 'shot-composer', 'vectorize', 'image-fixer', 'color-grade', 'shader-fx'];

function ProductionHub() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> Tools</Link>
        <span className={styles.brand}><Sparkles size={13} /> Production suite</span>
        <Link href="/account" className={styles.account}>Account</Link>
      </header>
      <section className={styles.hero}>
        <div className={styles.kicker}>PRODUCTION SKILLS BUNDLE · EDITABLE OUTPUTS</div>
        <h1>The production suite.</h1>
        <p>Hosted Blender simulations and renders, photo to 3D, layered vectors, shot cleanup, grading and real-time effects. Every tool returns editable files and runs from the browser, the REST API or your agent over MCP.</p>
      </section>
      <section className={styles.hub}>
        <div className={styles.hubGrid}>
          {PRODUCTION_SUITE.map((item) => (
            <Link key={item.href} href={item.href} className={styles.hubCard}>
              <b>{item.name}</b>
              <span>{item.copy}</span>
              <small>{item.price}</small>
            </Link>
          ))}
        </div>
        <div className={`${styles.panel} ${styles.controls}`}>
          <div className={styles.sectionLabel}>Connect your agent (MCP)</div>
          <p className={styles.hint} style={{ marginTop: 0 }}>Add ManifoldGen to Claude, Cursor or any MCP client. Tools: {[...PRODUCTION_TOOLS, ...MOTION_TOOLS.filter((tool) => !tool.variantOf)].map((tool) => tool.mcp).join(', ')}, plus create_upload, wait_for_job and list_services.</p>
          <div className={styles.code}><pre><code>{MCP_SETUP}</code></pre></div>
          <p className={styles.hint}>Prompts: {prompts.join(' · ')}. Start with <code>production-bundle</code> and describe what you want to make.</p>
        </div>
      </section>
    </main>
  );
}

export default function Page() {
  return (
    <>
      <JsonLd data={toolJsonLd(metadata, '/tools/production')} />
      <ProductionHub />
    </>
  );
}
