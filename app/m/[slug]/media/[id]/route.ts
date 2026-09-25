import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { supabaseMediaBucket } from '../../../../../lib/supabase/config';

export const dynamic = 'force-dynamic';

// Médias publics d'un Memory Link : accessibles uniquement via l'adresse secrète.
export async function GET(request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await context.params;
  if (!/^[a-z0-9]{8,32}$/.test(slug) || !/^[0-9a-f-]{36}$/i.test(id)) return new Response('Introuvable', { status: 404 });
  const admin = createSupabaseAdminClient();
  if (!admin) return new Response('Service indisponible', { status: 503 });
  const { data: link } = await admin.from('memory_links').select('project_id,status').eq('slug', slug).maybeSingle();
  if (!link || link.status === 'paused' || link.status === 'expired') return new Response('Introuvable', { status: 404 });
  const { data: row } = await admin.from('media').select('object_key,filename,content_type').eq('id', id).eq('project_id', link.project_id).maybeSingle();
  if (!row) return new Response('Introuvable', { status: 404 });

  const range = request.headers.get('range');
  const { data: signed } = await admin.storage.from(supabaseMediaBucket).createSignedUrl(row.object_key, 3600);
  if (signed?.signedUrl) {
    const upstream = await fetch(signed.signedUrl, { headers: range ? { range } : undefined });
    const headers = new Headers();
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!headers.get('content-type')) headers.set('content-type', row.content_type);
    headers.set('cache-control', 'private, max-age=3600');
    headers.set('content-disposition', `inline; filename="${row.filename.replace(/["\\]/g, '')}"`);
    return new Response(upstream.body, { status: upstream.status, headers });
  }
  const { data: object, error } = await admin.storage.from(supabaseMediaBucket).download(row.object_key);
  if (error || !object) return new Response('Introuvable', { status: 404 });
  return new Response(object.stream(), { headers: { 'content-type': row.content_type, 'cache-control': 'private, max-age=3600' } });
}
