// Intégration Stripe minimale via l'API REST (sans SDK) : Checkout + vérification des webhooks.

type CheckoutInput = {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  email: string;
  locale: 'fr' | 'en';
  label: string;
  origin: string;
};

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function createCheckoutSession(input: CheckoutInput): Promise<{ id: string; url: string } | null> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  const profile = input.locale === 'en' ? '/en/profile' : '/profil';
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('client_reference_id', input.orderId);
  params.set('customer_email', input.email);
  params.set('locale', input.locale);
  params.set('success_url', `${input.origin}${profile}?paiement=ok&commande=${encodeURIComponent(input.orderNumber)}`);
  params.set('cancel_url', `${input.origin}${profile}?paiement=annule&commande=${encodeURIComponent(input.orderNumber)}`);
  params.set('metadata[order_id]', input.orderId);
  params.set('metadata[order_number]', input.orderNumber);
  params.set('payment_intent_data[metadata][order_id]', input.orderId);
  params.set('payment_intent_data[metadata][order_number]', input.orderNumber);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
  params.set('line_items[0][price_data][unit_amount]', String(input.totalCents));
  params.set('line_items[0][price_data][product_data][name]', `${input.label} · ${input.orderNumber}`);
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': `checkout-${input.orderId}`,
    },
    body: params.toString(),
  });
  if (!response.ok) return null;
  const session = (await response.json()) as { id?: string; url?: string };
  return session.id && session.url ? { id: session.id, url: session.url } : null;
}

// Vérifie l'en-tête Stripe-Signature (HMAC SHA-256) avec une tolérance de 5 minutes.
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSeconds = 300) {
  if (!header) return false;
  const parts = header.split(',').map((part) => part.split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}
