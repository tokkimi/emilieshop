import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminContext, audit, badRequest, fetchAll, PAID_STATUSES } from '../../../../lib/admin-api';

export const dynamic = 'force-dynamic';

type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  company_name: string | null;
  preferred_locale: string;
  country_code: string | null;
  region_code: string | null;
  postal_code: string | null;
  shipping_address: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
type OrderRow = { id: string; owner_id: string; order_number: string; status: string; total_cents: number; created_at: string; product_code: string | null };
type ProjectRow = { id: string; owner_id: string; title: string; status: string; collection: string; updated_at: string };

const PROFILE_COLUMNS = 'id,email,display_name,phone,company_name,preferred_locale,country_code,region_code,postal_code,shipping_address,created_at,updated_at';

/** Every client, with what they bought: orders, money spent, projects. */
export async function GET(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const { db } = ctx;
  const id = new URL(request.url).searchParams.get('id');

  if (id) {
    const [profile, orders, projects] = await Promise.all([
      db.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle(),
      db.from('orders').select('*').eq('owner_id', id).order('created_at', { ascending: false }),
      db.from('projects').select('id,title,status,collection,progress,address,updated_at,created_at').eq('owner_id', id).order('updated_at', { ascending: false }),
    ]);
    if (profile.error || !profile.data) return badRequest('Client introuvable', 404);
    return NextResponse.json({ profile: profile.data, orders: orders.data || [], projects: projects.data || [] });
  }

  try {
    const [profiles, orders, projects] = await Promise.all([
      fetchAll<Profile>((from, to) => db.from('profiles').select(PROFILE_COLUMNS).order('created_at', { ascending: false }).range(from, to)),
      fetchAll<OrderRow>((from, to) => db.from('orders').select('id,owner_id,order_number,status,total_cents,created_at,product_code').range(from, to)),
      fetchAll<ProjectRow>((from, to) => db.from('projects').select('id,owner_id,title,status,collection,updated_at').range(from, to)),
    ]);
    const clients = profiles.map((profile) => {
      const own = orders.filter((order) => order.owner_id === profile.id);
      const paid = own.filter((order) => PAID_STATUSES.includes(order.status));
      return {
        ...profile,
        orderCount: own.length,
        paidCount: paid.length,
        spentCents: paid.reduce((sum, order) => sum + order.total_cents, 0),
        lastOrderAt: own.map((order) => order.created_at).sort().at(-1) || null,
        projectCount: projects.filter((project) => project.owner_id === profile.id).length,
      };
    });
    return NextResponse.json({ clients });
  } catch {
    return badRequest('Clients indisponibles', 503);
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(254).optional(),
  display_name: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  company_name: z.string().max(160).nullable().optional(),
  preferred_locale: z.enum(['fr', 'en']).optional(),
  country_code: z.string().max(2).nullable().optional(),
  region_code: z.string().max(10).nullable().optional(),
  postal_code: z.string().max(12).nullable().optional(),
  shipping_address: z.record(z.string(), z.string().max(200)).optional(),
});

/** Edit a client. Changing the email also changes the login email. */
export async function PATCH(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Informations invalides');
  const { id, email, ...fields } = parsed.data;
  const { db } = ctx;

  const { data: before } = await db.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
  if (!before) return badRequest('Client introuvable', 404);

  const update: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  if (email && email.toLowerCase() !== before.email.toLowerCase()) {
    const normalized = email.trim().toLowerCase();
    const { error } = await db.auth.admin.updateUserById(id, { email: normalized, email_confirm: true });
    if (error) return badRequest('Ce courriel est déjà utilisé par un autre compte.', 409);
    update.email = normalized;
  }
  const { data, error } = await db.from('profiles').update(update).eq('id', id).select(PROFILE_COLUMNS).single();
  if (error) return badRequest('Modification impossible', 500);

  const changed = Object.fromEntries(
    Object.keys(update)
      .filter((key) => key !== 'updated_at' && JSON.stringify((before as Record<string, unknown>)[key]) !== JSON.stringify(update[key]))
      .map((key) => [key, { avant: (before as Record<string, unknown>)[key] ?? null, après: update[key] ?? null }]),
  );
  await audit(ctx, 'client.update', 'profile', id, { email: data.email, changes: changed });
  return NextResponse.json({ profile: data });
}
