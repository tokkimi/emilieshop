import type Stripe from 'stripe';
import { formatCad } from './catalog';
import { createSupabaseAdminClient } from './supabase/server';
import { queueAndSendPaymentEmail } from './transactional-email';

type PaymentSession = Pick<Stripe.Checkout.Session, 'id' | 'amount_total' | 'currency' | 'payment_intent' | 'payment_status' | 'metadata'>;

export async function markOrderPaidFromCheckout(session: PaymentSession) {
  const orderId = session.metadata?.orderId;
  if (!orderId || session.payment_status !== 'paid') return { updated: false, reason: 'not-paid' } as const;
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error('database');
  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order || order.owner_id !== session.metadata?.ownerId) throw new Error('order');
  if (session.amount_total !== order.total_cents || session.currency?.toUpperCase() !== order.currency) throw new Error('amount');
  if (['paid','preflight','printing','shipped','delivered'].includes(order.status)) return { updated: false, reason: 'already-paid', order } as const;
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null;
  const paidAt = new Date().toISOString();
  const { error } = await admin.from('orders').update({
    status: 'paid',
    payment_provider: 'stripe',
    payment_reference: session.id,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    payment_status: 'paid',
    paid_at: paidAt,
    updated_at: paidAt,
  }).eq('id', order.id).eq('status', 'awaiting_payment');
  if (error) throw new Error('update');
  await queueAndSendPaymentEmail({
    orderId: order.id,
    orderNumber: order.order_number,
    email: order.customer_email,
    name: order.shipping_address?.name || 'Client',
    total: formatCad(order.total_cents, order.locale),
    locale: order.locale,
  });
  return { updated: true, order: { ...order, status: 'paid' } } as const;
}
