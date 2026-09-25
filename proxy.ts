import { NextResponse, type NextRequest } from 'next/server';
import { refreshSupabaseSession } from './lib/supabase/proxy';

// Un seul domaine pour que la session (cookies) reste valable partout :
// toutes les autres adresses redirigent vers memoiremaison.com.
const CANONICAL_HOST = 'memoiremaison.com';
const ALIAS_HOSTS = new Set([
  'www.memoiremaison.com',
  'memoiremaison.ca', 'www.memoiremaison.ca',
  'memoiremaison.net', 'www.memoiremaison.net',
  'memoiremaison.info', 'www.memoiremaison.info',
  'memoiremaison.store', 'www.memoiremaison.store',
  'emilieshop.vercel.app',
]);

export async function proxy(request: NextRequest) {
  const host = (request.headers.get('host') || '').toLowerCase().split(':')[0];
  if (ALIAS_HOSTS.has(host)) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = CANONICAL_HOST;
    url.port = '';
    return NextResponse.redirect(url, 308);
  }
  const path = request.nextUrl.pathname.replace(/\/+$/, '').toLowerCase();
  if (['/en/admin', '/administration', '/dashboard', '/en/dashboard', '/fondateur'].includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.redirect(url, 308);
  }
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
