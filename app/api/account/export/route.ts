import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { hasSupabasePublicConfig } from '../../../../lib/supabase/config';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  if (!hasSupabasePublicConfig()) return NextResponse.json({ error: 'Export cloud non configuré' }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  const [profile, projects, media, generations, approvals, orders, memoryLinks, threads] = await Promise.all([
    supabase!.from('profiles').select('*').eq('id', user.userId).maybeSingle(),
    supabase!.from('projects').select('*').eq('owner_id', user.userId),
    supabase!.from('media').select('id,project_id,filename,content_type,size_bytes,kind,created_at').eq('owner_id', user.userId),
    supabase!.from('book_generations').select('*').eq('owner_id', user.userId),
    supabase!.from('approvals').select('*').eq('owner_id', user.userId),
    supabase!.from('orders').select('*').eq('owner_id', user.userId),
    supabase!.from('memory_links').select('*').eq('owner_id', user.userId),
    supabase!.from('message_threads').select('*').eq('user_id', user.userId),
  ]);
  const threadIds = (threads.data || []).map((thread) => thread.id);
  const messages = threadIds.length ? await supabase!.from('messages').select('*').in('thread_id', threadIds) : { data: [] };
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), account: { id: user.userId, email: user.email }, profile: profile.data, projects: projects.data || [], media: media.data || [], bookGenerations: generations.data || [], approvals: approvals.data || [], orders: orders.data || [], memoryLinks: memoryLinks.data || [], messageThreads: threads.data || [], messages: messages.data || [] }, null, 2);
  return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="memoire-maison-export-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'private, no-store' } });
}
