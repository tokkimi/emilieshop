'use client';

export const CONSENT_KEY = 'memoire-measurement-v1';
export const CONSENT_EVENT = 'memoire-consent-change';
export const GA_ID = process.env.NEXT_PUBLIC_GA4_ID ?? '';
export const META_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '1437784654713890';
const gaEnabled = /^G-[A-Z0-9]+$/.test(GA_ID);
const metaEnabled = /^\d{5,25}$/.test(META_ID);

type Item = { item_id: string; item_name: string; price?: number; quantity: number };
type MeasurementWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: MetaQueue;
  _fbq?: MetaQueue;
};
type MetaQueue = ((...args: unknown[]) => void) & {
  queue: unknown[][];
  callMethod?: (...args: unknown[]) => void;
  push?: MetaQueue;
  loaded?: boolean;
  version?: string;
};

export function canMeasure() {
  try { return localStorage.getItem(CONSENT_KEY) === 'allow'; } catch { return false; }
}

export function track(event: 'page_view' | 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase' | 'sign_up' | 'generate_lead', options: { items?: Item[]; value?: number; transactionId?: string } = {}) {
  if (!canMeasure() || (!gaEnabled && !metaEnabled)) return;
  const w = window as MeasurementWindow;
  if (gaEnabled && !w.gtag) {
    const layer = w.dataLayer ??= [];
    w.gtag = function () { layer.push(arguments); };
    w.gtag('js', new Date());
    w.gtag('config', GA_ID, { send_page_view: false, allow_google_signals: false });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
  }
  if (metaEnabled && !w.fbq) {
    const pixel = ((...args: unknown[]) => {
      if (pixel.callMethod) pixel.callMethod(...args);
      else pixel.queue.push(args);
    }) as MetaQueue;
    pixel.queue = [];
    pixel.push = pixel;
    pixel.loaded = true;
    pixel.version = '2.0';
    w.fbq = w._fbq = pixel;
    pixel('init', META_ID);
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }
  const { items, value, transactionId } = options;
  const metaEvent = { page_view:'PageView', view_item:'ViewContent', add_to_cart:'AddToCart', begin_checkout:'InitiateCheckout', purchase:'Purchase', sign_up:'CompleteRegistration', generate_lead:'Lead' }[event];
  w.gtag?.('event', event, {
    ...(items ? { items } : {}),
    ...(value !== undefined ? { value, currency: 'CAD' } : {}),
    ...(transactionId ? { transaction_id: transactionId } : {}),
    page_location: location.origin + location.pathname,
    page_title: document.title,
  });
  const metaParams = {
    ...(items ? { content_type: 'product', content_ids: items.map(item => item.item_id), content_name: items.length === 1 ? items[0].item_name : undefined,
      contents: items.map(item => ({ id: item.item_id, quantity: item.quantity, item_price: item.price })) } : {}),
    ...(value !== undefined ? { value, currency: 'CAD' } : {}),
  };
  if (transactionId) w.fbq?.('track', metaEvent, metaParams, { eventID: transactionId });
  else w.fbq?.('track', metaEvent, metaParams);
}
