import type { GeneratedBook } from './book';
import { createSupabaseAdminClient } from './supabase/server';

export type MemoryLinkMedia = { id: string; kind: 'photo' | 'video' | 'audio'; filename: string };

export async function loadMemoryLink(slug: string) {
  if (!/^[a-z0-9]{8,32}$/.test(slug)) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data: link } = await admin.from('memory_links').select('project_id,status,expires_at').eq('slug', slug).maybeSingle();
  if (!link || link.status === 'paused' || link.status === 'expired') return null;
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return null;
  const [{ data: generation }, { data: media }] = await Promise.all([
    admin.from('book_generations').select('result_data').eq('project_id', link.project_id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('media').select('id,kind,filename,created_at').eq('project_id', link.project_id).order('created_at', { ascending: true }),
  ]);
  const book = (generation?.result_data || null) as GeneratedBook | null;
  return { projectId: link.project_id as string, book, media: (media || []) as MemoryLinkMedia[] };
}
