import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getChatGPTUser, type ChatGPTUser } from '../app/chatgpt-auth';
import { isAdmin, isOwnerUser } from './admin-auth';
import { createSupabaseAdminClient } from './supabase/server';

export type AdminContext = { user: ChatGPTUser; db: SupabaseClient; owner: boolean };

/**
 * Every admin route starts here: a verified admin session and the service
 * client (which bypasses row-level security, so it must never reach a
 * non-admin). Returns a response to send back when either is missing.
 */
export async function adminContext(): Promise<AdminContext | NextResponse> {
  const user = await getChatGPTUser();
  if (!user || !(await isAdmin(user))) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  return { user, db, owner: isOwnerUser(user) };
}

/**
 * Journal d'audit: who changed what, on which record, when. Never blocks the
 * action it records - a failed log write is reported in the server logs only.
 */
export async function audit(
  { db, user }: AdminContext,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  const row = { actor_id: user.userId as string | null, action, entity_type: entityType, entity_id: entityId, details: { ...details, actor_email: user.email } };
  let { error } = await db.from('audit_logs').insert(row);
  // An admin without a client profile cannot be the foreign key: keep the email only.
  if (error?.code === '23503') ({ error } = await db.from('audit_logs').insert({ ...row, actor_id: null }));
  if (error) console.error('Audit log write failed', { action, code: error.code });
}

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Supabase returns at most 1000 rows per request: read a whole result set
 * page by page (up to `cap` rows) so totals and charts are never truncated.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  cap = 100_000,
): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; from < cap; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return rows;
}

/** Order statuses that count as a sale (money received). */
export const PAID_STATUSES = ['paid', 'preflight', 'printing', 'shipped', 'delivered'];
