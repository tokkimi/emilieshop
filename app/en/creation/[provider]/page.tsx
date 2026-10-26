import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireChatGPTUser } from '../../../chatgpt-auth';
import { isAdmin } from '../../../../lib/admin-auth';
import { ProviderStudio } from '../../../components/ProviderStudio';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Print studios — Mémoire Maison', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== 'mpix' && provider !== 'prodigi') notFound();
  const user = await requireChatGPTUser(`/en/creation/${provider}`);
  if (!(await isAdmin(user))) redirect('/en/profile');
  return <ProviderStudio provider={provider} locale="en"/>;
}
