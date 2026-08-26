import type { Metadata } from 'next';
import { BookPreview } from '../components/BookPreview';
export const metadata:Metadata={title:'Aperçu du livre — Mémoire Maison',robots:{index:false,follow:false}};
export default function PreviewPage(){return <BookPreview/>}
