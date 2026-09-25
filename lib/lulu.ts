const productionBaseUrl = 'https://api.lulu.com';
const sandboxBaseUrl = 'https://api.sandbox.lulu.com';

export const LULU_DEFAULT_POD_PACKAGE_ID =
  process.env.LULU_POD_PACKAGE_ID || '0850X1100.FC.PRE.CW.080CW444.MXX';
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
    contactEmail: process.env.LULU_CONTACT_EMAIL || null,
    product: {
      podPackageId: LULU_DEFAULT_POD_PACKAGE_ID,
      name: 'Livre photo portrait — Couverture rigide',
      trimSize: '21,6 × 27,9 cm',
      pageCount: LULU_DEFAULT_PAGE_COUNT,
      interior: 'Couleur premium',
      paper: 'Papier blanc couché 80 lb',
      cover: 'Case Wrap · finition mate',
    },
  };
}

function baseUrlFor(environment: LuluEnvironment) {
  return environment === 'production' ? productionBaseUrl : sandboxBaseUrl;
}

function getBaseUrl() {
  return baseUrlFor(getLuluEnvironment());
}

const TOKEN_PATH = '/auth/realms/glasstree/protocol/openid-connect/token';

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
    `${getBaseUrl()}${TOKEN_PATH}`,
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

function timingSafeEquals(expected: string, supplied: string | null): boolean {
  if (!expected || !supplied || expected.length !== supplied.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return difference === 0;
}

export function isTrustedProductionRequest(request: Request) {
  return timingSafeEquals(
    process.env.LULU_ORDER_GATE_KEY || '',
    request.headers.get('x-memoire-production-key'),
  );
}

// Optional machine-to-machine gate for the read-only connection diagnostic.
// When LULU_DIAGNOSTICS_TOKEN is unset, this path is closed and only a
// signed-in administrator can run the diagnostic.
export function isTrustedDiagnosticsRequest(request: Request) {
  const expected = process.env.LULU_DIAGNOSTICS_TOKEN;
  if (!expected) return false;
  const suppliedHeader = request.headers.get('x-lulu-diagnostics-key');
  let suppliedQuery: string | null = null;
  try {
    suppliedQuery = new URL(request.url).searchParams.get('key');
  } catch {
    suppliedQuery = null;
  }
  return timingSafeEquals(expected, suppliedHeader || suppliedQuery);
}

export type LuluConnectionProbe = {
  environment: LuluEnvironment;
  baseUrl: string;
  ok: boolean;
  httpStatus: number | null;
  tokenType: string | null;
  expiresIn: number | null;
  error: string | null;
};

export type LuluConnectionResult = {
  configured: boolean;
  configuredEnvironment: LuluEnvironment;
  ordersEnabled: boolean;
  authenticated: boolean;
  detectedEnvironment: LuluEnvironment | null;
  probes: LuluConnectionProbe[];
  checkedAt: string;
};

// Reduce a Lulu error body to a short, secret-free summary. Only the standard
// OAuth error/description fields are surfaced; the raw body is never returned so
// nothing sensitive can leak through the diagnostic.
function summarizeLuluError(body: unknown): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const code = typeof record.error === 'string' ? record.error : null;
    const description =
      typeof record.error_description === 'string' ? record.error_description : null;
    const message = [code, description].filter(Boolean).join(': ');
    return message ? message.slice(0, 200) : 'unexpected_response';
  }
  if (typeof body === 'string' && body) return body.slice(0, 200);
  return 'unexpected_response';
}

// Attempt a client-credentials token exchange against one Lulu environment.
// Never throws, never returns the token itself: only whether authentication
// succeeded and a sanitized error otherwise.
async function probeLuluEnvironment(environment: LuluEnvironment): Promise<LuluConnectionProbe> {
  const baseUrl = baseUrlFor(environment);
  const probe: LuluConnectionProbe = {
    environment,
    baseUrl,
    ok: false,
    httpStatus: null,
    tokenType: null,
    expiresIn: null,
    error: null,
  };

  const clientKey = process.env.LULU_CLIENT_KEY;
  const clientSecret = process.env.LULU_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    probe.error = 'missing_credentials';
    return probe;
  }

  try {
    const response = await fetch(`${baseUrl}${TOKEN_PATH}`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientKey}:${clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    probe.httpStatus = response.status;
    const body = await readBody(response);
    if (response.ok && body && typeof body === 'object' && 'access_token' in body) {
      const token = body as TokenResponse & { token_type?: string };
      probe.ok = true;
      probe.tokenType = typeof token.token_type === 'string' ? token.token_type : 'Bearer';
      probe.expiresIn = typeof token.expires_in === 'number' ? token.expires_in : null;
    } else {
      probe.error = summarizeLuluError(body);
    }
  } catch (error) {
    probe.error =
      error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network_error';
  }
  return probe;
}

// Read-only connection check. Authenticates against the configured environment
// and, when `classify` is set and that fails, tries the other environment so an
// operator can tell whether the stored keys are sandbox or production keys.
// It never creates a print job and never triggers a payment.
export async function verifyLuluConnection(
  options: { classify?: boolean } = {},
): Promise<LuluConnectionResult> {
  const configuration = getLuluConfiguration();
  const configuredEnvironment = configuration.environment;
  const result: LuluConnectionResult = {
    configured: configuration.configured,
    configuredEnvironment,
    ordersEnabled: configuration.ordersEnabled,
    authenticated: false,
    detectedEnvironment: null,
    probes: [],
    checkedAt: new Date().toISOString(),
  };
  if (!configuration.configured) return result;

  const primary = await probeLuluEnvironment(configuredEnvironment);
  result.probes.push(primary);
  result.authenticated = primary.ok;
  if (primary.ok) result.detectedEnvironment = configuredEnvironment;

  if (!primary.ok && options.classify) {
    const other: LuluEnvironment =
      configuredEnvironment === 'production' ? 'sandbox' : 'production';
    const secondary = await probeLuluEnvironment(other);
    result.probes.push(secondary);
    if (secondary.ok && !result.detectedEnvironment) result.detectedEnvironment = other;
  }
  return result;
}
