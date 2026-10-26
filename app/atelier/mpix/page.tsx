import type { Metadata } from 'next';
import { BookCustomizer } from '../../components/BookCustomizer';
export const metadata:Metadata={title:'Atelier Mpix — Mémoire Maison',robots:{index:false,follow:false}};
export default function AtelierMpixPage() { return <BookCustomizer printer="mpix" />; }
