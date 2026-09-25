import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChatGPTUser } from '../../chatgpt-auth';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({ projectId: z.string().uuid() });
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function randomSlug(length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

// Crée (ou retrouve) l'adresse secrète du Memory Link d'un projet.
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Projet manquant' }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  const { projectId } = parsed.data;

  const { data: project } = await admin.from('projects').select('id').eq('id', projectId).eq('owner_id', user.userId).maybeSingle();
  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });

  const { data: existing } = await admin.from('memory_links').select('slug').eq('project_id', projectId).maybeSingle();
  if (existing?.slug) return NextResponse.json({ slug: existing.slug });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = randomSlug();
    const { error } = await admin.from('memory_links').insert({ project_id: projectId, owner_id: user.userId, slug, status: 'family' });
    if (!error) return NextResponse.json({ slug }, { status: 201 });
    const { data: raced } = await admin.from('memory_links').select('slug').eq('project_id', projectId).maybeSingle();
    if (raced?.slug) return NextResponse.json({ slug: raced.slug });
  }
  return NextResponse.json({ error: 'Création impossible' }, { status: 500 });
}
