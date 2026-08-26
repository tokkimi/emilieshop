import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminUser } from '../../lib/admin-auth';
import { requireChatGPTUser } from '../chatgpt-auth';
import { AdminDashboard } from '../components/AdminDashboard';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function AdminPage() {
  const user = await requireChatGPTUser('/admin');
  if (!isAdminUser(user)) redirect('/connexion?admin=refuse');
  return <AdminDashboard name={user.fullName || 'Émilie Cauvier'} />;
}
