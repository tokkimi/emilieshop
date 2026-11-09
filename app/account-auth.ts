import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../lib/supabase/server';

export type AccountUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getAccountUser(): Promise<AccountUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return null;
  const fullName = typeof data.user.user_metadata?.full_name === 'string'
    ? data.user.user_metadata.full_name : null;
  return {
    userId: data.user.id,
    email: data.user.email,
    fullName,
    displayName: fullName || data.user.email.split('@')[0],
  };
}

export async function requireAccountUser(returnTo: string): Promise<AccountUser> {
  const user = await getAccountUser();
  if (user) return user;
  redirect(accountSignInPath(returnTo));
}

export function accountSignInPath(returnTo: string): string {
  const next = safeRelativeReturnPath(returnTo);
  const path = next.startsWith('/en/') ? '/en/sign-in' : '/connexion';
  return `${path}?next=${encodeURIComponent(next)}`;
}

export function accountSignOutPath(returnTo = '/'): string {
  return `/auth/sign-out?next=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    if (url.origin !== 'https://app.local' || ['/auth/sign-out', '/auth/callback', '/callback'].includes(url.pathname)) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/'; }
}
