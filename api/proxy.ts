const upstreamOrigin = 'https://memoire-maison-emilie.bimabima700700.chatgpt.site';
const upstreamHost = new URL(upstreamOrigin).host;

export const config = { runtime: 'edge' };

// Request headers that describe the Vercel proxy hop rather than the real
// client. Forwarding them upstream leaks the proxy chain and can trip the
// upstream Cloudflare WAF / bot management, so they are stripped.
const HOP_BY_HOP_REQUEST_HEADERS = [
  'host',
  'content-length',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-for',
  'x-real-ip',
  'x-vercel-id',
  'x-vercel-deployment-url',
  'x-vercel-forwarded-for',
  'x-vercel-proxied-for',
  'x-vercel-proxy-signature',
  'x-vercel-proxy-signature-ts',
  'forwarded',
  'via',
];

const UPSTREAM_PROXY_HEADER_PREFIXES = [
  'cf-',
  'x-forwarded-',
  'x-real-ip',
  'x-vercel-',
];

export default async function proxy(request: Request) {
  const bypassToken = process.env.SITES_BYPASS_TOKEN;
  if (!bypassToken) {
    return new Response('Deployment configuration is incomplete.', { status: 503 });
  }

  const incomingUrl = new URL(request.url);
  const requestedPath = incomingUrl.searchParams.get('upstreamPath') ?? '';
  incomingUrl.searchParams.delete('upstreamPath');

  const upstreamUrl = new URL(`/${requestedPath.replace(/^\/+/, '')}`, upstreamOrigin);
  upstreamUrl.search = incomingUrl.searchParams.toString();

  const headers = new Headers(request.headers);
  for (const [header] of headers) {
    const normalized = header.toLowerCase();
    if (
      HOP_BY_HOP_REQUEST_HEADERS.includes(normalized) ||
      UPSTREAM_PROXY_HEADER_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    ) {
      headers.delete(header);
    }
  }
  sanitizeCloudflareCookies(headers);
  headers.set('accept-encoding', 'identity');
  headers.set('OAI-Sites-Authorization', `Bearer ${bypassToken}`);

  rewriteOriginHeader(headers, 'origin', incomingUrl.origin);
  rewriteOriginHeader(headers, 'referer', incomingUrl.origin);

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  if (upstreamResponse.status >= 400) {
    console.warn('[memoire-proxy] upstream rejected request', {
      status: upstreamResponse.status,
      path: upstreamUrl.pathname,
      cfRay: upstreamResponse.headers.get('cf-ray'),
      cfMitigated: upstreamResponse.headers.get('cf-mitigated'),
      contentType: upstreamResponse.headers.get('content-type'),
      hadIncomingCookie: request.headers.has('cookie'),
    });
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-encoding');
  responseHeaders.set('x-content-source', 'memoire-maison');

  const location = responseHeaders.get('location');
  if (location) {
    const rewritten = rewriteUpstreamUrl(location, incomingUrl.origin);
    if (rewritten !== location) responseHeaders.set('location', rewritten);
  }

  responseHeaders.delete('set-cookie');
  const setCookies =
    typeof upstreamResponse.headers.getSetCookie === 'function'
      ? upstreamResponse.headers.getSetCookie()
      : [];
  for (const cookie of setCookies) {
    if (isCloudflareCookie(cookie)) continue;
    responseHeaders.append('set-cookie', rewriteSetCookieDomain(cookie));
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

function rewriteOriginHeader(headers: Headers, name: string, proxyOrigin: string) {
  const value = headers.get(name);
  if (!value) return;
  if (value === proxyOrigin || value.startsWith(`${proxyOrigin}/`)) {
    headers.set(name, value.replace(proxyOrigin, upstreamOrigin));
  }
}

function rewriteUpstreamUrl(value: string, proxyOrigin: string): string {
  if (value.startsWith(upstreamOrigin)) {
    return value.replace(upstreamOrigin, proxyOrigin);
  }
  if (value.startsWith(`//${upstreamHost}`)) {
    return value.replace(`//${upstreamHost}`, `//${new URL(proxyOrigin).host}`);
  }
  return value;
}

function rewriteSetCookieDomain(cookie: string): string {
  return cookie
    .split(';')
    .filter((part) => part.trim().toLowerCase().indexOf('domain=') !== 0)
    .join(';');
}

function sanitizeCloudflareCookies(headers: Headers) {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return;

  const safeCookies = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .filter((cookie) => !isCloudflareCookie(cookie));

  if (safeCookies.length) headers.set('cookie', safeCookies.join('; '));
  else headers.delete('cookie');
}

function isCloudflareCookie(cookie: string): boolean {
  const name = cookie.split('=', 1)[0]?.trim().toLowerCase() || '';
  return name.startsWith('cf_') || name.startsWith('__cf') || name === '_cfuvid';
}
