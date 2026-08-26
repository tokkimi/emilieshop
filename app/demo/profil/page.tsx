import type { Metadata } from 'next';
import { SiteHeader } from '../../components/SiteHeader';
import { CustomerDashboard } from '../../components/CustomerDashboard';
export const metadata:Metadata={robots:{index:false,follow:false}};
export default function DemoProfile(){return <><SiteHeader compact/><CustomerDashboard name="Sophie Martin" email="sophie.demo@memoiremaison.ca"/></>}
