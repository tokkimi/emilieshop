import type { Metadata } from 'next';
import { BookCustomizer } from '../../components/BookCustomizer';
export const metadata:Metadata={title:'Atelier Prodigi — Mémoire Maison',robots:{index:false,follow:false}};
export default function AtelierProdigiPage() { return <BookCustomizer printer="prodigi" />; }
