import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { getDb } from '../../../../db';
import { media } from '../../../../db/schema';
import { hasSupabasePublicConfig, supabaseMediaBucket } from '../../../../lib/supabase/config';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return new Response('Authentification requise', { status: 401 });
  const { id } = await context.params;
  if (hasSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data: row } = await supabase!.from('media').select('object_key,filename,content_type').eq('id', id).eq('owner_id', user.userId).maybeSingle();
    if (!row) return new Response('Média introuvable', { status: 404 });
    const { data: object, error } = await supabase!.storage.from(supabaseMediaBucket).download(row.object_key);
    if (error || !object) return new Response('Média introuvable', { status: 404 });
    return new Response(object.stream(), { headers: { 'content-type': row.content_type, 'cache-control': 'private, max-age=3600', 'content-disposition': `inline; filename="${row.filename.replace(/["\\]/g, '')}"` } });
  }
  const rows = await getDb().select().from(media).where(and(eq(media.id, id), eq(media.ownerId, user.userId))).limit(1);
  if (!rows.length) return new Response('Média introuvable', { status: 404 });
  const object = await env.FILES.get(rows[0].objectKey);
  if (!object) return new Response('Média introuvable', { status: 404 });
  return new Response(object.body, { headers: { 'content-type': rows[0].contentType, 'cache-control': 'private, max-age=3600', 'content-disposition': `inline; filename="${rows[0].filename.replace(/["\\]/g, '')}"` } });
}
