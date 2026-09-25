import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MemoryLinkExperience } from '../../components/MemoryLinkExperience';
import { ensureCompleteBook, type GeneratedBook } from '../../../lib/book';
import { supabaseMediaBucket } from '../../../lib/supabase/config';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Memory Link privé — Mémoire Maison', robots: { index: false, follow: false } };

export default async function PrivateMemoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(slug)) notFound();
  const db = createSupabaseAdminClient();
  if (!db) notFound();
  const { data: link } = await db.from('memory_links').select('*').eq('slug', slug).in('status', ['private','family']).maybeSingle();
  // This server component is evaluated once per request; the access expiry must use request time.
  // eslint-disable-next-line react-hooks/purity
  if (!link || (link.expires_at && new Date(link.expires_at).getTime() < Date.now())) notFound();
  const { data: generation } = await db.from('book_generations').select('result_data').eq('project_id', link.project_id).eq('owner_id', link.owner_id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (!generation?.result_data) notFound();
  const book = ensureCompleteBook(generation.result_data as GeneratedBook);
  const ids = book.media.map((item) => item.id);
  const { data: mediaRows } = ids.length ? await db.from('media').select('id,object_key').in('id', ids).eq('owner_id', link.owner_id) : { data: [] };
  const signed = new Map<string,string>();
  await Promise.all((mediaRows || []).map(async (item) => {
    const { data } = await db.storage.from(supabaseMediaBucket).createSignedUrl(item.object_key, 60 * 60);
    if (data?.signedUrl) signed.set(item.id, data.signedUrl);
  }));
  const hydrated = { ...book, media: book.media.map((item) => ({ ...item, previewUrl: signed.get(item.id) })) };
  return <MemoryLinkExperience locale={book.locale} initialBook={hydrated} />;
}
