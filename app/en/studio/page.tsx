import type { Metadata } from 'next';
import { BookCustomizer } from '../../components/BookCustomizer';
export const metadata:Metadata={title:'Creation studio — Mémoire Maison',robots:{index:false,follow:false}};
export default function Page(){return <BookCustomizer locale="en" printer="prodigi"/>;}
