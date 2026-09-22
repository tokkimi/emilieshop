import type { Metadata } from 'next';
import { MemoryLinkExperience } from '../../../components/MemoryLinkExperience';

export const metadata: Metadata = { title: 'Private Memory Link — Mémoire Maison', robots: { index: false, follow: false } };

export default function EnglishMemoryDemoPage() {
  return <MemoryLinkExperience locale="en" />;
}
