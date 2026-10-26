import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { supabaseMediaBucket } from '../../../../lib/supabase/config';

export const dynamic = 'force-dynamic';
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('prepare'), projectId: z.string().uuid(), filename: z.string().min(1).max(180), contentType: z.string().regex(/^(image|video|audio)\//), size: z.number().int().positive().max(25 * 1024 * 1024) }),
  z.object({ action: z.literal('complete'), projectId: z.string().uuid(), id: z.string().uuid(), path: z.string().max(400), filename: z.string().min(1).max(180) }),
]);

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Reconnectez-vous pour enregistrer vos photos.' }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Fichier invalide : image, audio ou vidéo de 25 Mo maximum.' }, { status: 400 });
  const input = parsed.data;
  const db = await createSupabaseServerClient();
  if (!db) return NextResponse.json({ error: 'Le stockage est indisponible.' }, { status: 503 });
  const { data: project, error: projectError } = await db.from('projects').select('id').eq('id', input.projectId).eq('owner_id', user.userId).maybeSingle();
  if (projectError) return NextResponse.json({ error: 'Le projet ne peut pas être vérifié.' }, { status: 503 });
  if (!project) return NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 });
  if (input.action === 'prepare') {
    const id = crypto.randomUUID();
    const name = input.filename.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
    const path = `${user.userId}/${input.projectId}/${id}-${name}`;
    const { data, error } = await db.storage.from(supabaseMediaBucket).createSignedUploadUrl(path);
    if (error) {
      console.error('Media upload preparation failed', { code: error.name });
      return NextResponse.json({ error: 'Le stockage refuse l’envoi. Votre fichier reste sur votre appareil.' }, { status: 503 });
    }
    return NextResponse.json({ id, path, token: data.token, bucket: supabaseMediaBucket }, { headers: { 'cache-control': 'no-store' } });
  }
  const folder = `${user.userId}/${input.projectId}`;
  const name = input.path.slice(folder.length + 1);
  if (!input.path.startsWith(`${folder}/${input.id}-`) || name.includes('/')) return NextResponse.json({ error: 'Chemin de fichier invalide.' }, { status: 400 });
  const { data: files, error } = await db.storage.from(supabaseMediaBucket).list(folder, { search: name, limit: 10 });
  const object = files?.find((file) => file.name === name);
  const contentType = String(object?.metadata?.mimetype || '');
  const size = Number(object?.metadata?.size || 0);
  if (error || !object || !/^(image|video|audio)\//.test(contentType) || !size || size > 25 * 1024 * 1024) return NextResponse.json({ error: 'Le fichier envoyé n’a pas pu être vérifié.' }, { status: 409 });
  const { error: mediaError } = await db.from('media').upsert({ id: input.id, project_id: input.projectId, owner_id: user.userId, object_key: input.path, filename: input.filename, content_type: contentType, size_bytes: size, kind: contentType.startsWith('video/') ? 'video' : contentType.startsWith('audio/') ? 'audio' : 'photo' }, { onConflict: 'id' });
  if (mediaError) return NextResponse.json({ error: 'Le fichier est envoyé mais son enregistrement a échoué. Réessayez.' }, { status: 503 });
  return NextResponse.json({ id: input.id }, { status: 201 });
}
