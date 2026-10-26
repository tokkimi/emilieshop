import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { supabaseMediaBucket } from '../../../../../lib/supabase/config';

export const dynamic = 'force-dynamic';

// Médias publics d'un Memory Link : accessibles uniquement via l'adresse secrète.
export async function GET(request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(slug) || !/^[0-9a-f-]{36}$/i.test(id)) return new Response('Introuvable', { status: 404 });
  const admin = createSupabaseAdminClient();
  if (!admin) return new Response('Service indisponible', { status: 503 });
  const { data: link } = await admin.from('memory_links').select('project_id,status,expires_at').eq('slug', slug).maybeSingle();
  if (!link || !['private','family'].includes(link.status) || (link.expires_at && new Date(link.expires_at).getTime() < Date.now())) return new Response('Introuvable', { status: 404 });
  const { data: row } = await admin.from('media').select('object_key,filename,content_type').eq('id', id).eq('project_id', link.project_id).maybeSingle();
  if (!row) return new Response('Introuvable', { status: 404 });

  const { data: signed } = await admin.storage.from(supabaseMediaBucket).createSignedUrl(row.object_key, 300);
  if (!signed?.signedUrl) return new Response('Introuvable', { status:404 });
  return new Response(null,{status:307,headers:{location:signed.signedUrl,'cache-control':'private, no-store'}});
}
