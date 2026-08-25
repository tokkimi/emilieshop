import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { bookGenerations, projects } from '../../../db/schema';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'Projet manquant' }, { status: 400 });
  const rows = await getDb().select().from(bookGenerations).where(and(eq(bookGenerations.projectId, projectId), eq(bookGenerations.ownerId, user.userId))).orderBy(desc(bookGenerations.updatedAt)).limit(1);
  if (!rows.length) return NextResponse.json({ error: 'Aperçu introuvable' }, { status: 404 });
  return NextResponse.json({ generation: { ...rows[0], result: JSON.parse(rows[0].resultJson) } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  const input = await request.json() as Record<string, unknown>;
  const projectId = String(input.projectId || '');
  const id = String(input.id || crypto.randomUUID());
  const db = getDb();
  const owned = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, user.userId))).limit(1);
  if (!owned.length) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
  const now = new Date();
  await db.insert(bookGenerations).values({ id, projectId, ownerId: user.userId, locale: input.locale === 'en' ? 'en' : 'fr', status: 'ready', model: String(input.model || 'editorial'), inputJson: JSON.stringify(input.source || {}), resultJson: JSON.stringify(input.book || {}), usageJson: JSON.stringify(input.usage || {}), version: Number(input.version || 1), createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: bookGenerations.id, set: { resultJson: JSON.stringify(input.book || {}), usageJson: JSON.stringify(input.usage || {}), version: Number(input.version || 1), updatedAt: now } });
  return NextResponse.json({ id }, { status: 201 });
}
