import type { ChatGPTUser } from '../app/chatgpt-auth';
import { createSupabaseAdminClient } from './supabase/server';

const launchOwnerEmail = 'emilie@equipecauvier.com';
/** Dedicated admin login created for the owner; always has full access. */
export const SITE_ADMIN_EMAIL = 'admin@memoiremaison.com';

/** site_settings key holding the admin emails added from the dashboard. */
export const ADMIN_EMAILS_SETTING = 'admin_emails';

function emailList(value: string) {
  return value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function normalized(user: ChatGPTUser) {
  return user.email.trim().toLowerCase();
}

// Propriétaire : ADMIN_EMAILS (fondatrice). Seule à pouvoir gérer les accès admin.
export function isOwnerUser(user: ChatGPTUser): boolean {
  return [...emailList(process.env.ADMIN_EMAILS || launchOwnerEmail), SITE_ADMIN_EMAIL].includes(normalized(user));
}

// Accès administrateur par variables Vercel : ADMIN_EMAILS (fondatrice) + ADMIN_TEST_EMAILS (comptes de test).
export function isAdminUser(user: ChatGPTUser): boolean {
  return isOwnerUser(user) || emailList(process.env.ADMIN_TEST_EMAILS || '').includes(normalized(user));
}

/** Admin emails added from the dashboard (Paramètres → Accès administrateur). */
export async function listDashboardAdminEmails(): Promise<string[]> {
  const db = createSupabaseAdminClient();
  if (!db) return [];
  const { data } = await db.from('site_settings').select('value').eq('key', ADMIN_EMAILS_SETTING).maybeSingle();
  const value = data?.value as { emails?: unknown } | null;
  return Array.isArray(value?.emails)
    ? value.emails.filter((email): email is string => typeof email === 'string').map((email) => email.toLowerCase())
    : [];
}

// Accès administrateur complet : variables Vercel, ou accès ajoutés depuis le tableau de bord.
export async function isAdmin(user: ChatGPTUser | null): Promise<boolean> {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return (await listDashboardAdminEmails()).includes(normalized(user));
}
