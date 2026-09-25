import { NextResponse } from 'next/server';
import { getStripe } from '../../../../lib/stripe';
import { markOrderPaidFromCheckout } from '../../../../lib/stripe-payments';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!stripe || !secret || !signature) return NextResponse.json({ error: 'Webhook non configuré.' }, { status: 503 });
  const rawBody = await request.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: 'Base indisponible.' }, { status: 503 });
  const { data: existing } = await admin.from('stripe_webhook_events').select('id').eq('id', event.id).maybeSingle();
  if (existing) return NextResponse.json({ received: true, duplicate: true });
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await markOrderPaidFromCheckout(event.data.object);
    }
    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      if (session.metadata?.orderId) await admin.from('orders').update({ payment_status: 'expired', updated_at: new Date().toISOString() }).eq('id', session.metadata.orderId).eq('status', 'awaiting_payment');
    }
    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object;
      if (intent.metadata?.orderId) await admin.from('orders').update({ payment_status: 'failed', payment_failure_message: intent.last_payment_error?.message || null, updated_at: new Date().toISOString() }).eq('id', intent.metadata.orderId).eq('status', 'awaiting_payment');
    }
    if (event.type === 'charge.refunded') {
      const charge = event.data.object;
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId && charge.refunded) await admin.from('orders').update({ status: 'refunded', payment_status: 'refunded', refund_cents: charge.amount_refunded, updated_at: new Date().toISOString() }).eq('stripe_payment_intent_id', paymentIntentId);
    }
    await admin.from('stripe_webhook_events').insert({ id: event.id, type: event.type, livemode: event.livemode, processed_at: new Date().toISOString() });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed', error);
    return NextResponse.json({ error: 'Traitement temporairement impossible.' }, { status: 503 });
  }
}
