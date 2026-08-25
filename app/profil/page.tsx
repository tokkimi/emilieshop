import { requireChatGPTUser } from '../chatgpt-auth';
import { SiteHeader } from '../components/SiteHeader';
import { CustomerDashboard } from '../components/CustomerDashboard';
export const dynamic='force-dynamic';
export default async function ProfilePage(){const user=await requireChatGPTUser('/profil');return <><SiteHeader compact/><CustomerDashboard name={user.displayName} email={user.email}/></>}
