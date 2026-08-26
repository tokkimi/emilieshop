import type { Metadata } from 'next';
import { EnglishStudio } from '../../components/EnglishStudio';
export const metadata:Metadata={title:'Creation studio — Mémoire Maison',robots:{index:false,follow:false}};
export default function EnglishStudioPage(){return <EnglishStudio/>}
