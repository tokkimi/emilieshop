import type { Metadata } from 'next';
import { BookPreview } from '../../components/BookPreview';
export const metadata:Metadata={title:'Book preview — Mémoire Maison',robots:{index:false,follow:false}};
export default function EnglishPreviewPage(){return <BookPreview locale="en"/>}
