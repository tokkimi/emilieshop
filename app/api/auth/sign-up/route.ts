import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

// Création de compte immédiate (sans courriel de confirmation bloquant) :
// le client peut se connecter tout de suite et poursuivre sa commande sans
// quitter la page ni perdre son projet.
const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const email = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name?.trim();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: name ? { full_name: name } : undefined,
  });
  if (error || !data.user) {
    const message = (error?.message || '').toLowerCase();
    if (message.includes('already') || message.includes('exists') || message.includes('registered')) {
      return NextResponse.json({ error: 'exists' }, { status: 409 });
    }
    if (message.includes('password')) return NextResponse.json({ error: 'weak_password' }, { status: 400 });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }

  await admin.from('profiles').upsert(
    { id: data.user.id, email, display_name: name || email.split('@')[0], updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
