import type { Metadata } from 'next';
import { PrinterChoice } from '../../components/PrinterChoice';
export const metadata:Metadata={title:'Creation studio — Mémoire Maison',robots:{index:false,follow:false}};
export default function EnglishStudioPage(){return <PrinterChoice locale="en"/>}
