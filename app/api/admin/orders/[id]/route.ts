import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminContext, audit, badRequest } from '../../../../../lib/admin-api';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z.enum(['pending', 'awaiting_payment', 'paid', 'preflight', 'printing', 'shipped', 'delivered', 'cancelled', 'refunded', 'blocked']).optional(),
  tracking_url: z.string().url().max(500).nullable().optional(),
  customer_email: z.string().email().max(254).optional(),
  provider_cost_cents: z.number().int().min(0).max(10_000_000).optional(),
  payment_fee_cents: z.number().int().min(0).max(10_000_000).optional(),
  refund_cents: z.number().int().min(0).max(10_000_000).optional(),
});

/** Follow-up of a sale: status, tracking link, real costs and refunds. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return badRequest('Modification invalide');

  const { data: before } = await ctx.db.from('orders').select('*').eq('id', id).maybeSingle();
  if (!before) return badRequest('Commande introuvable', 404);
  if (parsed.data.refund_cents !== undefined && parsed.data.refund_cents > before.total_cents) {
    return badRequest('Le remboursement dépasse le total de la commande.');
  }

  const { data, error } = await ctx.db
    .from('orders')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return badRequest('Modification impossible', 500);

  const changes = Object.fromEntries(
    Object.entries(parsed.data)
      .filter(([key, value]) => before[key] !== value)
      .map(([key, value]) => [key, { avant: before[key] ?? null, après: value ?? null }]),
  );
  await audit(ctx, 'order.update', 'order', id, { order_number: before.order_number, changes });
  return NextResponse.json({ order: data });
}
