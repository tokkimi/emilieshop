import type { Metadata } from 'next';
import { SiteHeader } from '../../../components/SiteHeader';
import { CustomerDashboard } from '../../../components/CustomerDashboard';
export const metadata:Metadata={robots:{index:false,follow:false}};
export default function EnglishDemoProfile(){return <><SiteHeader locale="en" compact/><CustomerDashboard name="Sophie Martin" email="sophie.demo@memoiremaison.ca" locale="en"/></>}
