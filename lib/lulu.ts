const productionBaseUrl = 'https://api.lulu.com';
const sandboxBaseUrl = 'https://api.sandbox.lulu.com';

export const LULU_DEFAULT_POD_PACKAGE_ID =
  process.env.LULU_POD_PACKAGE_ID || '0850X0850.FC.PRE.CW.080CW444.MXX';
export const LULU_DEFAULT_PAGE_COUNT = 24;

type LuluEnvironment = 'sandbox' | 'production';
type TokenResponse = { access_token: string; expires_in?: number };

let cachedToken: { value: string; expiresAt: number; environment: LuluEnvironment } | null = null;

export class LuluApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'LuluApiError';
    this.status = status;
    this.details = details;
  }
}

export function getLuluEnvironment(): LuluEnvironment {
  return process.env.LULU_API_ENV === 'production' ? 'production' : 'sandbox';
}

export function getLuluConfiguration() {
  const environment = getLuluEnvironment();
  const configured = Boolean(process.env.LULU_CLIENT_KEY && process.env.LULU_CLIENT_SECRET);

  return {
    configured,
    environment,
    ordersEnabled: configured && process.env.LULU_ORDERS_ENABLED === 'true',
    product: {
      podPackageId: LULU_DEFAULT_POD_PACKAGE_ID,
      name: 'Livre photo carré — Couverture rigide',
      trimSize: '21,6 × 21,6 cm',
      pageCount: LULU_DEFAULT_PAGE_COUNT,
      interior: 'Couleur premium',
      paper: 'Papier blanc couché 80 lb',
      cover: 'Case Wrap · finition mate',
    },
  };
}

function getBaseUrl() {
  return getLuluEnvironment() === 'production' ? productionBaseUrl : sandboxBaseUrl;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function getAccessToken(): Promise<string> {
  const environment = getLuluEnvironment();
  const now = Date.now();
  if (cachedToken && cachedToken.environment === environment && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.value;
  }

  const clientKey = process.env.LULU_CLIENT_KEY;
  const clientSecret = process.env.LULU_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new LuluApiError('La connexion Lulu n’est pas encore configurée.', 503, null);
  }

  const response = await fetch(
    `${getBaseUrl()}/auth/realms/glasstree/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientKey}:${clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    },
  );
  const body = await readBody(response);
  if (!response.ok || !body || typeof body !== 'object' || !('access_token' in body)) {
    throw new LuluApiError('Lulu a refusé la connexion.', response.status, body);
  }

  const token = body as TokenResponse;
  cachedToken = {
    value: token.access_token,
    expiresAt: now + Math.max(60, token.expires_in || 300) * 1000,
    environment,
  };
  return token.access_token;
}

export async function luluRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
    signal: init.signal || AbortSignal.timeout(25_000),
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new LuluApiError('Lulu n’a pas pu traiter cette demande.', response.status, body);
  }
  return body as T;
}

export function isTrustedProductionRequest(request: Request) {
  const expected = process.env.LULU_ORDER_GATE_KEY;
  const supplied = request.headers.get('x-memoire-production-key');
  if (!expected || !supplied || expected.length !== supplied.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return difference === 0;
}
