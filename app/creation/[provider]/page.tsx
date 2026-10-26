import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireChatGPTUser } from '../../chatgpt-auth';
import { isAdmin } from '../../../lib/admin-auth';
import { ProviderStudio } from '../../components/ProviderStudio';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ateliers imprimeurs — Mémoire Maison', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== 'mpix' && provider !== 'prodigi') notFound();
  const user = await requireChatGPTUser(`/creation/${provider}`);
  if (!(await isAdmin(user))) redirect('/profil');
  return <ProviderStudio provider={provider}/>;
}
