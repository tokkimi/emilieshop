import type { Metadata } from 'next';
import { requireChatGPTUser } from '../chatgpt-auth';
import { SiteHeader } from '../components/SiteHeader';
import { CustomerDashboard } from '../components/CustomerDashboard';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Mon espace — Mémoire Maison',robots:{index:false,follow:false}};
export default async function ProfilePage(){const user=await requireChatGPTUser('/profil');return <><SiteHeader compact/><CustomerDashboard name={user.displayName} email={user.email}/></>}
