import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { getPlan } from '../../../../lib/catalog';
import { getStripe, siteOrigin } from '../../../../lib/stripe';
import { markOrderPaidFromCheckout } from '../../../../lib/stripe-payments';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const postSchema = z.object({ orderId: z.string().uuid() });

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Commande invalide.' }, { status: 400 });
  const stripe = getStripe();
  const admin = createSupabaseAdminClient();
  if (!stripe || !admin) return NextResponse.json({ error: 'Le paiement sécurisé est momentanément indisponible.' }, { status: 503 });
  const { data: order } = await admin.from('orders').select('*').eq('id', parsed.data.orderId).eq('owner_id', user.userId).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  if (order.status !== 'awaiting_payment') return NextResponse.json({ error: 'Cette commande ne peut plus être payée.' }, { status: 409 });
  const locale = order.locale === 'en' ? 'en' : 'fr';
  const plan = getPlan(order.product_code);
  const origin = siteOrigin(request);
  const lineItems = [
    {
      quantity: 1,
      price_data: {
        currency: 'cad',
        unit_amount: order.subtotal_cents,
        product_data: {
          name: `Maison Mémoire — ${plan.name[locale]}`,
          description: locale === 'en' ? `${plan.tagline.en} · Proof approved` : `${plan.tagline.fr} · Aperçu approuvé`,
        },
      },
    },
    ...(order.shipping_cents > 0 ? [{ quantity: 1, price_data: { currency: 'cad', unit_amount: order.shipping_cents, product_data: { name: locale === 'en' ? 'Maison Mémoire — Delivery' : 'Maison Mémoire — Livraison' } } }] : []),
    ...(order.tax_cents > 0 ? [{ quantity: 1, price_data: { currency: 'cad', unit_amount: order.tax_cents, product_data: { name: locale === 'en' ? 'Applicable taxes' : 'Taxes applicables' } } }] : []),
  ];
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale,
      customer_email: order.customer_email || user.email,
      client_reference_id: order.id,
      line_items: lineItems,
      success_url: `${origin}/${locale === 'en' ? 'en/order' : 'commande'}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale === 'en' ? 'en/order' : 'commande'}?payment=cancelled&order=${encodeURIComponent(order.id)}&project=${encodeURIComponent(order.project_id)}`,
      custom_text: { submit: { message: locale === 'en' ? 'Secure payment to Maison Mémoire. Your approved book will then enter preflight.' : 'Paiement sécurisé à Maison Mémoire. Votre livre approuvé passera ensuite au contrôle prépresse.' } },
      invoice_creation: { enabled: true, invoice_data: { description: `Maison Mémoire — ${order.order_number}`, metadata: { orderId: order.id } } },
      payment_intent_data: {
        description: `Maison Mémoire — ${order.order_number}`,
        receipt_email: order.customer_email || user.email,
        statement_descriptor_suffix: 'MAISON MEMOIRE',
        metadata: { orderId: order.id, orderNumber: order.order_number, ownerId: order.owner_id },
      },
      metadata: { orderId: order.id, orderNumber: order.order_number, ownerId: order.owner_id, projectId: order.project_id },
    }, { idempotencyKey: `checkout-${order.id}` });
    await admin.from('orders').update({ payment_provider: 'stripe', payment_reference: session.id, stripe_checkout_session_id: session.id, payment_status: 'checkout_created', updated_at: new Date().toISOString() }).eq('id', order.id);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout creation failed', error);
    return NextResponse.json({ error: 'Stripe n’a pas pu ouvrir le paiement sécurisé.' }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  const stripe = getStripe();
  if (!stripe || !sessionId || !sessionId.startsWith('cs_')) return NextResponse.json({ error: 'Session invalide.' }, { status: 400 });
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.ownerId !== user.userId) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
    const result = await markOrderPaidFromCheckout(session);
    return NextResponse.json({ paid: session.payment_status === 'paid', orderNumber: session.metadata?.orderNumber, updated: result.updated });
  } catch {
    return NextResponse.json({ error: 'Paiement impossible à vérifier.' }, { status: 503 });
  }
}
