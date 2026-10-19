import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabasePublicConfig } from '../../../../lib/supabase/config';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

// TEMPORARY: creates the owner's login once, then answers 404 forever.
// Delete this file on the next deployment.
const TOKEN_SHA256 = '25aec996532ca80fa9c6f164ea7dce79734793c6072816024f2c60e73077b54d';
const OWNER_EMAIL = 'emilie@equipecauvier.com';

function authorized(token: string | null) {
  if (!token) return false;
  return timingSafeEqual(createHash('sha256').update(token).digest(), Buffer.from(TOKEN_SHA256, 'hex'));
}

export async function GET(request: Request) {
  const notFound = NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!authorized(new URL(request.url).searchParams.get('token'))) return notFound;
  const db = createSupabaseAdminClient();
  const config = getSupabasePublicConfig();
  if (!db || !config) return notFound;
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list?.users.some((user) => user.email?.toLowerCase() === OWNER_EMAIL)) return notFound;

  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const password = Array.from(randomBytes(16), (byte) => alphabet[byte % alphabet.length]).join('');
  const { data, error } = await db.auth.admin.createUser({ email: OWNER_EMAIL, password, email_confirm: true, user_metadata: { full_name: 'Emilie Cauvier' } });
  if (error || !data.user) return NextResponse.json({ error: error?.message || 'create failed' }, { status: 500 });
  await db.from('profiles').upsert({ id: data.user.id, email: OWNER_EMAIL, display_name: 'Emilie Cauvier', updated_at: new Date().toISOString() }, { onConflict: 'id' });
  const login = await createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } }).auth.signInWithPassword({ email: OWNER_EMAIL, password });
  await db.from('audit_logs').insert({ action: 'admin.owner_login_created', entity_type: 'admin_access', entity_id: OWNER_EMAIL });
  return NextResponse.json({ email: OWNER_EMAIL, password, loginWorks: !login.error, loginError: login.error?.message || null }, { headers: { 'cache-control': 'no-store' } });
}
