// Prodigi Print API v4.0 — https://www.prodigi.com/print-api/docs/reference/
// Auth is a single key sent as X-API-Key. Sandbox unless PRODIGI_ENV=live.

const LIVE_URL = 'https://api.prodigi.com/v4.0';
const SANDBOX_URL = 'https://api.sandbox.prodigi.com/v4.0';

/** Hardcover A4 portrait photo book. Override with PRODIGI_BOOK_SKU. */
export const PRODIGI_DEFAULT_BOOK_SKU = 'BOOK-FE-A4-P-HARD-G';

export class ProdigiApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'ProdigiApiError';
    this.status = status;
    this.details = details;
  }
}

export function getProdigiConfiguration() {
  const live = process.env.PRODIGI_ENV === 'live';
  const configured = Boolean(process.env.PRODIGI_API_KEY);
  return {
    configured,
    environment: live ? ('live' as const) : ('sandbox' as const),
    ordersEnabled: configured && process.env.PRODIGI_ORDERS_ENABLED === 'true',
    sku: process.env.PRODIGI_BOOK_SKU || PRODIGI_DEFAULT_BOOK_SKU,
    shippingMethod: process.env.PRODIGI_SHIPPING_METHOD || 'Standard',
  };
}

export async function prodigiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.PRODIGI_API_KEY;
  if (!key) throw new ProdigiApiError('Prodigi API key missing', 503, null);
  const base = getProdigiConfiguration().environment === 'live' ? LIVE_URL : SANDBOX_URL;
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'X-API-Key': key, 'content-type': 'application/json', accept: 'application/json', ...(init.headers || {}) },
    signal: init.signal || AbortSignal.timeout(25000),
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const outcome = body && typeof body === 'object' ? (body as { outcome?: string }).outcome : null;
    throw new ProdigiApiError(`Prodigi ${response.status}${outcome ? ` ${outcome}` : ''}`, response.status, body);
  }
  return body as T;
}

export type ProdigiProduct = {
  sku: string;
  description?: string;
  printAreas?: Record<string, { required?: boolean }>;
  variants?: { printAreaSizes?: Record<string, { horizontalResolution?: number; verticalResolution?: number }> }[];
};

export async function getProdigiProduct(sku: string) {
  const result = await prodigiRequest<{ product: ProdigiProduct }>(`/products/${encodeURIComponent(sku)}`);
  return result.product;
}

/** Spine width in millimetres for a photo book of this many pages. */
export async function getProdigiSpineMm(sku: string, numberOfPages: number, destinationCountryCode: string) {
  const result = await prodigiRequest<{ success?: boolean; spineInfo?: { widthMm?: number } }>('/products/spine', {
    method: 'POST',
    body: JSON.stringify({ sku, destinationCountryCode, numberOfPages, state: 'draft' }),
  });
  const width = Number(result.spineInfo?.widthMm);
  return Number.isFinite(width) && width > 0 ? width : null;
}

export type ProdigiQuote = {
  shipmentMethod?: string;
  costSummary?: { items?: { amount: string; currency: string }; shipping?: { amount: string; currency: string }; totalCost?: { amount: string; currency: string }; totalTax?: { amount: string; currency: string } };
};

export async function getProdigiQuote(input: { sku: string; copies: number; pageCount: number; countryCode: string; currencyCode?: string; printAreas: string[] }) {
  const result = await prodigiRequest<{ outcome: string; quotes?: ProdigiQuote[]; issues?: unknown[] }>('/quotes', {
    method: 'POST',
    body: JSON.stringify({
      destinationCountryCode: input.countryCode,
      currencyCode: input.currencyCode || 'CAD',
      shippingMethod: getProdigiConfiguration().shippingMethod,
      items: [{ sku: input.sku, copies: input.copies, assets: input.printAreas.map((printArea) => ({ printArea })) }],
    }),
  });
  return result;
}

/** Order status as Prodigi reports it: stage plus the first tracking link, if any. */
export function prodigiOrderState(order: unknown) {
  const value = (order && typeof order === 'object' ? order : {}) as {
    status?: { stage?: string };
    shipments?: { tracking?: { url?: string } }[];
  };
  const stage = String(value.status?.stage || 'Unknown');
  const tracking = value.shipments?.find((shipment) => shipment.tracking?.url)?.tracking?.url || null;
  return { stage, tracking };
}
