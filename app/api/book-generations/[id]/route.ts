import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { getDb } from '../../../../db';
import { bookGenerations } from '../../../../db/schema';
import { hasSupabasePublicConfig } from '../../../../lib/supabase/config';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  const { id } = await context.params;
  const input = await request.json() as { book?: unknown; version?: number; status?: string };
  if (hasSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase!.from('book_generations').update({ result_data: input.book || {}, version: Number(input.version || 1), status: String(input.status || 'ready').slice(0, 20), updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.userId).select('id').maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'Aperçu introuvable' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  const owned = await getDb().select({ id: bookGenerations.id }).from(bookGenerations).where(and(eq(bookGenerations.id, id), eq(bookGenerations.ownerId, user.userId))).limit(1);
  if (!owned.length) return NextResponse.json({ error: 'Aperçu introuvable' }, { status: 404 });
  await getDb().update(bookGenerations).set({ resultJson: JSON.stringify(input.book || {}), version: Number(input.version || 1), status: String(input.status || 'ready').slice(0, 20), updatedAt: new Date() }).where(eq(bookGenerations.id, id));
  return NextResponse.json({ ok: true });
}
