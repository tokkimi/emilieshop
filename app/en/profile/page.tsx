import { requireChatGPTUser } from '../../chatgpt-auth';
import { SiteHeader } from '../../components/SiteHeader';
import { CustomerDashboard } from '../../components/CustomerDashboard';
export const dynamic='force-dynamic';
export default async function EnglishProfile(){const user=await requireChatGPTUser('/en/profile');return <><SiteHeader locale="en" compact/><CustomerDashboard name={user.displayName} email={user.email} locale="en"/></>}
