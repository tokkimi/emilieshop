import type { Metadata } from 'next';
import { BookCustomizer } from '../../../components/BookCustomizer';
export const metadata:Metadata={title:'Prodigi studio — Mémoire Maison',robots:{index:false,follow:false}};
export default function StudioProdigiPage() { return <BookCustomizer locale="en" printer="prodigi" />; }
