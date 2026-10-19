import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { SITE_ADMIN_EMAIL } from '../../../../lib/admin-auth';
import { getSupabasePublicConfig } from '../../../../lib/supabase/config';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

// TEMPORARY one-time setup route, removed right after use. Creates the admin
// and test logins, proves they can sign in, and checks every table the
// dashboard reads. Only callable with the secret whose SHA-256 is below.
const TOKEN_SHA256 = '2d33c15792c6696c6bdec4be93f6a391849da7c22fc591d18cb2d5c75c39c0c5';
const TEST_EMAIL = 'test@memoiremaison.com';

function authorized(token: string | null) {
  if (!token) return false;
  return timingSafeEqual(createHash('sha256').update(token).digest(), Buffer.from(TOKEN_SHA256, 'hex'));
}

function newPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(randomBytes(16), (byte) => alphabet[byte % alphabet.length]).join('');
}

export async function GET(request: Request) {
  if (!authorized(new URL(request.url).searchParams.get('token'))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const db = createSupabaseAdminClient();
  const config = getSupabasePublicConfig();
  if (!db || !config) return NextResponse.json({ error: 'Supabase admin client not configured', hasPublicConfig: Boolean(config) }, { status: 503 });

  // Auth settings as the browser sees them (captcha, disabled email login…).
  const settings = await fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.publishableKey } })
    .then(async (response) => ({ status: response.status, body: await response.json().catch(() => null) }))
    .catch((error: Error) => ({ status: 0, body: error.message }));

  const { data: list, error: listError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const accounts: Record<string, unknown>[] = [];
  for (const [email, name] of [[SITE_ADMIN_EMAIL, 'Administration Mémoire Maison'], [TEST_EMAIL, 'Client test']] as const) {
    const password = newPassword();
    const existing = list?.users.find((user) => user.email?.toLowerCase() === email);
    let userId: string | null = null;
    let step = '';
    if (existing) {
      const { error } = await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { full_name: name } });
      userId = error ? null : existing.id;
      step = error ? `update failed: ${error.message}` : 'existing account, password reset';
    } else {
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
      userId = data?.user?.id || null;
      step = error ? `create failed: ${error.message}` : 'created';
    }
    if (!userId) {
      accounts.push({ email, step });
      continue;
    }
    const profile = await db.from('profiles').upsert({ id: userId, email, display_name: name, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    // Sign in exactly like the login page does.
    const browserLike = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await browserLike.auth.signInWithPassword({ email, password });
    accounts.push({ email, step, password, profileError: profile.error?.message || null, loginWorks: !login.error, loginError: login.error?.message || null });
  }

  // The owner's own login, if it exists: is it usable?
  const owner = list?.users.find((user) => user.email?.toLowerCase() === 'emilie@equipecauvier.com');
  const tables = ['profiles', 'projects', 'orders', 'analytics_events', 'audit_logs', 'site_settings', 'accounting_accounts', 'journal_entries', 'journal_lines', 'stripe_webhook_events', 'email_outbox', 'newsletter_subscribers'];
  const health: Record<string, unknown> = {};
  for (const table of tables) {
    const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
    health[table] = error ? `ERREUR: ${error.message}` : count;
  }
  await db.from('audit_logs').insert({ action: 'admin.bootstrap', entity_type: 'admin_access', entity_id: SITE_ADMIN_EMAIL, details: { accounts: accounts.map((item) => item.email) } });
  return NextResponse.json(
    {
      accounts,
      ownerAccount: owner ? { exists: true, confirmed: Boolean(owner.email_confirmed_at), lastSignIn: owner.last_sign_in_at || null } : { exists: false },
      userCount: list?.users.length ?? null,
      listError: listError?.message || null,
      authSettings: settings,
      health,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
