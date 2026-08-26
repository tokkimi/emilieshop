import type { Metadata } from 'next';
import { AdminDashboard } from '../../components/AdminDashboard';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DemoAdminPage() {
  return <AdminDashboard name="Emilie Cauvier" demo />;
}
