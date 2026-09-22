import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { media, projects } from '../../../db/schema';
import { hasSupabasePublicConfig, supabaseMediaBucket } from '../../../lib/supabase/config';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
export const dynamic = 'force-dynamic';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  const projectId = String(form.get('projectId') || '');
  if (!(file instanceof File) || !projectId) return NextResponse.json({ error: 'Fichier ou projet manquant' }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Le fichier dépasse 25 Mo' }, { status: 413 });
  if (!['image/', 'video/', 'audio/'].some((prefix) => file.type.startsWith(prefix))) return NextResponse.json({ error: 'Type de fichier non pris en charge' }, { status: 415 });
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
  const objectKey = `${user.userId}/${projectId}/${id}-${safeName}`;
  const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'photo';
  if (hasSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data: project } = await supabase!.from('projects').select('id').eq('id', projectId).eq('owner_id', user.userId).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    const { error: uploadError } = await supabase!.storage.from(supabaseMediaBucket).upload(objectKey, file, { contentType: file.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: 'Le téléversement cloud a échoué.' }, { status: 503 });
    const { error: mediaError } = await supabase!.from('media').insert({ id, project_id: projectId, owner_id: user.userId, object_key: objectKey, filename: file.name.slice(0, 180), content_type: file.type, size_bytes: file.size, kind });
    if (mediaError) {
      await supabase!.storage.from(supabaseMediaBucket).remove([objectKey]);
      return NextResponse.json({ error: 'Le média n’a pas pu être enregistré.' }, { status: 503 });
    }
    return NextResponse.json({ id, filename: file.name, url: `/api/media/${id}` }, { status: 201 });
  }
  const db = getDb();
  const ownedProject = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, user.userId))).limit(1);
  if (!ownedProject.length) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
  await env.FILES.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type }, customMetadata: { ownerId: user.userId, projectId } });
  await db.insert(media).values({ id, projectId, ownerId: user.userId, objectKey, filename: file.name.slice(0, 180), contentType: file.type, sizeBytes: file.size, kind, createdAt: new Date() });
  return NextResponse.json({ id, filename: file.name, url: `/api/media/${id}` }, { status: 201 });
}
