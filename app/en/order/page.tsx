import type {Metadata} from 'next';
import {requireChatGPTUser} from '../../chatgpt-auth';
import {CheckoutForm} from '../../components/CheckoutForm';
import {SiteHeader} from '../../components/SiteHeader';
export const metadata:Metadata={title:'Order — Mémoire Maison',robots:{index:false,follow:false}};
export default async function OrderPage(){await requireChatGPTUser('/en/order');return <><SiteHeader locale="en" compact/><CheckoutForm locale="en"/></>}
