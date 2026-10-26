import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { projects, users } from '../../../db/schema';
import { hasSupabasePublicConfig, supabaseMediaBucket } from '../../../lib/supabase/config';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  if (hasSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase!.from('projects').select('*').eq('owner_id', user.userId).order('updated_at', { ascending: false });
    if (error) return NextResponse.json({ error: 'Les projets sont momentanément indisponibles.' }, { status: 503 });
    return NextResponse.json({ projects: data });
  }
  const rows = await getDb().select().from(projects).where(eq(projects.ownerId, user.userId)).orderBy(desc(projects.updatedAt));
  return NextResponse.json({ projects: rows });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  const input = await request.json() as Record<string, unknown>;
  const id = crypto.randomUUID();
  if (hasSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    const { error: profileError } = await supabase!.from('profiles').upsert({ id: user.userId, email: user.email, display_name: user.displayName, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (profileError) return NextResponse.json({ error: 'Le profil n’a pas pu être préparé.' }, { status: 503 });
    const { error } = await supabase!.from('projects').insert({ id, owner_id: user.userId, title: String(input.title || 'Notre Maison').slice(0, 100), address: String(input.address || '').slice(0, 180), years: String(input.years || '').slice(0, 60), collection: String(input.collection || 'Essentiel').slice(0, 30), cover_color: String(input.coverColor || 'forest').slice(0, 20), answers: input.answers || {}, options: input.options || [] });
    if (error) return NextResponse.json({ error: 'Le projet n’a pas pu être enregistré.' }, { status: 503 });
    return NextResponse.json({ id }, { status: 201 });
  }
  const now = new Date();
  const db = getDb();
  await db.insert(users).values({ id: user.userId, email: user.email, displayName: user.displayName, createdAt: now }).onConflictDoUpdate({ target: users.id, set: { email: user.email, displayName: user.displayName } });
  await db.insert(projects).values({ id, ownerId: user.userId, title: String(input.title || 'Notre Maison').slice(0, 100), address: String(input.address || '').slice(0, 180), years: String(input.years || '').slice(0, 60), collection: String(input.collection || 'Essentiel').slice(0, 30), coverColor: String(input.coverColor || 'forest').slice(0, 20), answersJson: JSON.stringify(input.answers || {}), optionsJson: JSON.stringify(input.options || []), createdAt: now, updatedAt: now });
  return NextResponse.json({ id }, { status: 201 });
}

// Drafts only: once a book is approved or ordered it stays on file.
const DELETABLE_STATUSES = ['draft', 'generating', 'preview', 'changes_requested'];

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Projet invalide' }, { status: 400 });
  if (hasSupabasePublicConfig()) {
    const supabase = (await createSupabaseServerClient())!;
    const { data: project } = await supabase.from('projects').select('id,status').eq('id', id).eq('owner_id', user.userId).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    if (!DELETABLE_STATUSES.includes(project.status)) return NextResponse.json({ error: 'Ce livre est déjà validé ou commandé : il ne peut plus être supprimé.' }, { status: 409 });
    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('project_id', id);
    if (count) return NextResponse.json({ error: 'Ce livre a une commande : il ne peut plus être supprimé.' }, { status: 409 });
    // Remove the uploaded files first; the rows go with the project (cascade).
    const { data: media } = await supabase.from('media').select('object_key').eq('project_id', id).eq('owner_id', user.userId);
    const keys = (media || []).map((item) => item.object_key).filter(Boolean);
    if (keys.length) await supabase.storage.from(supabaseMediaBucket).remove(keys);
    const { error } = await supabase.from('projects').delete().eq('id', id).eq('owner_id', user.userId);
    if (error) return NextResponse.json({ error: 'Le brouillon n’a pas pu être supprimé.' }, { status: 503 });
    return NextResponse.json({ deleted: id });
  }
  await getDb().delete(projects).where(and(eq(projects.id, id), eq(projects.ownerId, user.userId)));
  return NextResponse.json({ deleted: id });
}
