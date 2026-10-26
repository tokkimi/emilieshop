import type { Metadata } from 'next';
import { PrinterChoice } from '../components/PrinterChoice';
export const metadata:Metadata={title:'Atelier de création — Mémoire Maison',robots:{index:false,follow:false}};
export default function AtelierPage() { return <PrinterChoice />; }
