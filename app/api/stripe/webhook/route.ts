import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { verifyStripeSignature } from '../../../../lib/stripe';

export const dynamic = 'force-dynamic';

type StripeEvent = {
  type: string;
  data: {
    object: {
      payment_status?: string;
      client_reference_id?: string | null;
      metadata?: Record<string, string> | null;
      amount_refunded?: number;
      amount?: number;
    };
  };
};

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook non configuré' }, { status: 503 });
  const payload = await request.text();
  const valid = await verifyStripeSignature(payload, request.headers.get('stripe-signature'), secret);
  if (!valid) return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });

  const event = JSON.parse(payload) as StripeEvent;
  const object = event.data.object;
  const orderId = object.metadata?.order_id || object.client_reference_id || null;
  if (!orderId) return NextResponse.json({ received: true });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });

  if (
    (event.type === 'checkout.session.completed' && object.payment_status === 'paid') ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const { error } = await admin
      .from('orders')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .in('status', ['pending', 'awaiting_payment']);
    if (error) return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 });
  }

  if (event.type === 'charge.refunded') {
    const refunded = object.amount_refunded || 0;
    const fullyRefunded = refunded >= (object.amount || 0);
    const update: Record<string, unknown> = { refund_cents: refunded, updated_at: new Date().toISOString() };
    if (fullyRefunded) update.status = 'refunded';
    const { error } = await admin.from('orders').update(update).eq('id', orderId);
    if (error) return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
