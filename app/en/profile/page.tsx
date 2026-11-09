import type { Metadata } from 'next';
import { requireAccountUser } from '../../account-auth';
import { SiteHeader } from '../../components/SiteHeader';
import { CustomerDashboard } from '../../components/CustomerDashboard';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'My space — Mémoire Maison',robots:{index:false,follow:false}};
export default async function EnglishProfile(){const user=await requireAccountUser('/en/profile');return <><SiteHeader locale="en" compact/><CustomerDashboard name={user.displayName} email={user.email} locale="en"/></>}
