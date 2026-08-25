const upstreamOrigin = 'https://memoire-maison-emilie.bimabima700700.chatgpt.site';

export const config = { runtime: 'edge' };

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
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('x-forwarded-host');
  headers.delete('x-vercel-id');
  headers.set('accept-encoding', 'identity');
  headers.set('OAI-Sites-Authorization', `Bearer ${bypassToken}`);

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-encoding');
  responseHeaders.set('x-content-source', 'memoire-maison');

  const location = responseHeaders.get('location');
  if (location?.startsWith(upstreamOrigin)) {
    responseHeaders.set('location', location.replace(upstreamOrigin, incomingUrl.origin));
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
