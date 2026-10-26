import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadMemoryLink } from '../../../lib/memory-link';
import { ensureCompleteBook } from '../../../lib/book';
import { MemoryBookReader } from '../../components/MemoryBookReader';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title:'Memory Link — Mémoire Maison', robots:{index:false,follow:false} };
export default async function Page({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params; const data=await loadMemoryLink(slug); if(!data?.book)notFound();
 const source=ensureCompleteBook(data.book);
 const media=data.media.map((item)=>({...source.media.find((m)=>m.id===item.id),id:item.id,name:item.filename,kind:item.kind,previewUrl:`/m/${slug}/media/${item.id}`}));
 return <MemoryBookReader book={{...source,media}} en={source.locale==='en'}/>;
}
