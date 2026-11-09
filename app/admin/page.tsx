import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '../../lib/admin-auth';
import { requireAccountUser } from '../account-auth';
import { AdminDashboard } from '../components/AdminDashboard';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function AdminPage() {
  const user = await requireAccountUser('/admin');
  if (!(await isAdmin(user))) redirect('/connexion?admin=refuse');
  return <AdminDashboard name={user.fullName || 'Emilie Cauvier'} />;
}
