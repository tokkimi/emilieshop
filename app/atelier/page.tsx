import type { Metadata } from 'next';
import { BookCustomizer } from '../components/BookCustomizer';
export const metadata:Metadata={title:'Atelier de création — Mémoire Maison',robots:{index:false,follow:false}};
export default function Page(){return <BookCustomizer printer="prodigi"/>;}
