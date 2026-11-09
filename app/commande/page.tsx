import type {Metadata} from 'next';
import {requireAccountUser} from '../account-auth';
import {CheckoutForm} from '../components/CheckoutForm';
import {SiteHeader} from '../components/SiteHeader';
export const metadata:Metadata={title:'Commande — Mémoire Maison',robots:{index:false,follow:false}};
export default async function OrderPage(){await requireAccountUser('/commande');return <><SiteHeader compact/><CheckoutForm/></>}
