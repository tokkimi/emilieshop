import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { approvals, projects } from '../../../db/schema';
import { hasSupabasePublicConfig } from '../../../lib/supabase/config';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  const input = await request.json() as { projectId?: string; versionHash?: string };
  if (!input.projectId || !input.versionHash) return NextResponse.json({ error: 'Validation incomplète' }, { status: 400 });
  if (hasSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data: project } = await supabase!.from('projects').select('id').eq('id', input.projectId).eq('owner_id', user.userId).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    const id = crypto.randomUUID();
    const approvedAt = new Date().toISOString();
    const { error } = await supabase!.from('approvals').insert({ id, project_id: input.projectId, owner_id: user.userId, version_hash: input.versionHash.slice(0, 180), approved_at: approvedAt, user_agent: request.headers.get('user-agent')?.slice(0, 300) });
    if (error) return NextResponse.json({ error: 'L’approbation n’a pas pu être enregistrée.' }, { status: 503 });
    await supabase!.from('projects').update({ status: 'approved', progress: 90, updated_at: approvedAt }).eq('id', input.projectId).eq('owner_id', user.userId);
    return NextResponse.json({ id, approvedAt }, { status: 201 });
  }
  const owned = await getDb().select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.ownerId, user.userId))).limit(1);
  if (!owned.length) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
  const id = crypto.randomUUID();
  await getDb().insert(approvals).values({ id, projectId: input.projectId, ownerId: user.userId, versionHash: input.versionHash.slice(0, 180), approvedAt: new Date(), userAgent: request.headers.get('user-agent')?.slice(0, 300) });
  return NextResponse.json({ id, approvedAt: new Date().toISOString() }, { status: 201 });
}
