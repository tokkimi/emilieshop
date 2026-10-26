import type { Metadata } from 'next';
import { BookCustomizer } from '../../../components/BookCustomizer';
export const metadata:Metadata={title:'Mpix studio — Mémoire Maison',robots:{index:false,follow:false}};
export default function StudioMpixPage() { return <BookCustomizer locale="en" printer="mpix" />; }
