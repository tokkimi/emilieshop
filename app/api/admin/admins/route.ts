import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminContext, audit, badRequest } from '../../../../lib/admin-api';
import { ADMIN_EMAILS_SETTING, listDashboardAdminEmails, SITE_ADMIN_EMAIL } from '../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

function envList(value: string | undefined) {
  return (value || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
}

async function saveEmails(ctx: Exclude<Awaited<ReturnType<typeof adminContext>>, NextResponse>, emails: string[]) {
  return ctx.db
    .from('site_settings')
    .upsert({ key: ADMIN_EMAILS_SETTING, value: { emails }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

/** Who can open the admin. */
export async function GET() {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({
    owner: ctx.owner,
    owners: [...new Set([...envList(process.env.ADMIN_EMAILS || 'emilie@equipecauvier.com'), SITE_ADMIN_EMAIL])],
    testAdmins: envList(process.env.ADMIN_TEST_EMAILS),
    dashboardAdmins: await listDashboardAdminEmails(),
  });
}

const postSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(128).optional(),
  name: z.string().max(120).optional(),
});

/**
 * Owner only: give someone admin access. With a password, the login is
 * created at the same time (already confirmed, usable right away).
 */
export async function POST(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.owner) return badRequest('Seule la propriétaire peut gérer les accès administrateur.', 403);
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Courriel invalide ou mot de passe trop court (10 caractères minimum).');
  const email = parsed.data.email.trim().toLowerCase();

  let created = false;
  if (parsed.data.password) {
    const { data, error } = await ctx.db.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: parsed.data.name ? { full_name: parsed.data.name } : undefined,
    });
    if (error && !/already|exists|registered/i.test(error.message)) return badRequest('Création du compte impossible : ' + error.message, 400);
    if (data?.user) {
      created = true;
      await ctx.db.from('profiles').upsert(
        { id: data.user.id, email, display_name: parsed.data.name || email.split('@')[0], updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      );
    }
  }

  const emails = [...new Set([...(await listDashboardAdminEmails()), email])];
  const { error } = await saveEmails(ctx, emails);
  if (error) return badRequest('Enregistrement impossible', 500);
  await audit(ctx, 'admin.grant', 'admin_access', email, { compte_créé: created });
  return NextResponse.json({ email, created, dashboardAdmins: emails }, { status: 201 });
}

/** Owner only: remove an access added from the dashboard. */
export async function DELETE(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.owner) return badRequest('Seule la propriétaire peut gérer les accès administrateur.', 403);
  const email = (new URL(request.url).searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return badRequest('Courriel manquant');
  const emails = (await listDashboardAdminEmails()).filter((item) => item !== email);
  const { error } = await saveEmails(ctx, emails);
  if (error) return badRequest('Enregistrement impossible', 500);
  await audit(ctx, 'admin.revoke', 'admin_access', email);
  return NextResponse.json({ dashboardAdmins: emails });
}
