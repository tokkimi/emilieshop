import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { approvals, projects } from '../../../db/schema';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  const input = await request.json() as { projectId?: string; versionHash?: string };
  if (!input.projectId || !input.versionHash) return NextResponse.json({ error: 'Validation incomplète' }, { status: 400 });
  const owned = await getDb().select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.ownerId, user.userId))).limit(1);
  if (!owned.length) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
  const id = crypto.randomUUID();
  await getDb().insert(approvals).values({ id, projectId: input.projectId, ownerId: user.userId, versionHash: input.versionHash.slice(0, 180), approvedAt: new Date(), userAgent: request.headers.get('user-agent')?.slice(0, 300) });
  return NextResponse.json({ id, approvedAt: new Date().toISOString() }, { status: 201 });
}
