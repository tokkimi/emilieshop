import Stripe from 'stripe';

let client: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!client) client = new Stripe(secretKey, { appInfo: { name: 'Maison Mémoire', version: '1.0.0' } });
  return client;
}

export function getStripeConfiguration() {
  return {
    configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    checkoutConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test',
    brandName: 'Maison Mémoire',
  } as const;
}

export function siteOrigin(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (request) return new URL(request.url).origin;
  return 'https://emilieshop.vercel.app';
}
