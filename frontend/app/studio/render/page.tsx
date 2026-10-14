import type { Metadata } from 'next';
import RenderClient from './render-client';

export const metadata: Metadata = {
  title: 'Studio Render - ManifoldGen',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RenderClient />;
}
