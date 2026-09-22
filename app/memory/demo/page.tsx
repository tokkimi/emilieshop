import type { Metadata } from 'next';
import { MemoryLinkExperience } from '../../components/MemoryLinkExperience';

export const metadata: Metadata = { title: 'Memory Link privé — Mémoire Maison', robots: { index: false, follow: false } };

export default function MemoryDemoPage() {
  return <MemoryLinkExperience />;
}
