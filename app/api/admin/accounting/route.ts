import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { isAdminUser } from '../../../../lib/admin-auth';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
type JournalLine = { account_code: string; debit_cents: number; credit_cents: number; memo: string | null };
type JournalEntry = { id: string; entry_date: string; reference: string; description: string; source: string; status: string; journal_lines: JournalLine[] };
type AccountingAccount = { code: string; name: string; account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' };

async function admin() {
  const user = await getChatGPTUser();
  return user && isAdminUser(user) ? user : null;
}

export async function GET(request: Request) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  const year = Number(new URL(request.url).searchParams.get('year') || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2026 || year > 2100) return NextResponse.json({ error: 'Exercice invalide' }, { status: 400 });
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const [{ data: orders, error: orderError }, { data: entryData, error: entryError }, { data: accountData, error: accountError }] = await Promise.all([
    db.from('orders').select('id,order_number,status,total_cents,subtotal_cents,shipping_cents,tax_cents,provider_cost_cents,payment_fee_cents,refund_cents,created_at,customer_email,invoice_number').gte('created_at', from).lt('created_at', to).order('created_at', { ascending: false }),
    db.from('journal_entries').select('id,entry_date,reference,description,source,status,journal_lines(account_code,debit_cents,credit_cents,memo)').gte('entry_date', from).lt('entry_date', to).order('entry_date', { ascending: false }),
    db.from('accounting_accounts').select('code,name,account_type').eq('active', true).order('code'),
  ]);
  if (orderError || entryError || accountError) return NextResponse.json({ error: 'Rapport indisponible' }, { status: 503 });
  const paid = (orders || []).filter((order) => ['paid', 'preflight', 'printing', 'shipped', 'delivered'].includes(order.status));
  const revenue = paid.reduce((sum, order) => sum + order.subtotal_cents + order.shipping_cents - order.refund_cents, 0);
  const taxes = paid.reduce((sum, order) => sum + order.tax_cents, 0);
  const providerCosts = paid.reduce((sum, order) => sum + order.provider_cost_cents, 0);
  const paymentFees = paid.reduce((sum, order) => sum + order.payment_fee_cents, 0);
  const entries = (entryData || []) as JournalEntry[];
  const accounts = (accountData || []) as AccountingAccount[];
  const accountMap = new Map(accounts.map((account) => [account.code, account]));
  const balances: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.status !== 'posted') continue;
    for (const line of entry.journal_lines || []) {
      const account = accountMap.get(line.account_code);
      if (!account) continue;
      const normalDebit = account.account_type === 'asset' || account.account_type === 'expense';
      const movement = normalDebit ? line.debit_cents - line.credit_cents : line.credit_cents - line.debit_cents;
      balances[line.account_code] = (balances[line.account_code] || 0) + movement;
    }
  }
  return NextResponse.json({ year, orders: orders || [], entries, accounts, metrics: { revenueCents: revenue, taxPayableCents: taxes, providerCostCents: providerCosts, paymentFeeCents: paymentFees, grossMarginCents: revenue - providerCosts - paymentFees, orderCount: paid.length }, balances });
}

const postSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().min(2).max(80),
  description: z.string().min(2).max(240),
  source: z.enum(['manual', 'supplier', 'adjustment']).default('manual'),
  lines: z.array(z.object({ accountCode: z.string().min(3).max(20), debitCents: z.number().int().min(0), creditCents: z.number().int().min(0), memo: z.string().max(240).optional() })).min(2).max(20),
});

export async function POST(request: Request) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Écriture comptable invalide' }, { status: 400 });
  const input = parsed.data;
  const debits = input.lines.reduce((sum, line) => sum + line.debitCents, 0);
  const credits = input.lines.reduce((sum, line) => sum + line.creditCents, 0);
  if (debits !== credits || debits <= 0) return NextResponse.json({ error: 'Les débits et crédits doivent être égaux.' }, { status: 400 });
  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
  const entryId = crypto.randomUUID();
  const { error } = await db.from('journal_entries').insert({ id: entryId, entry_date: input.entryDate, reference: input.reference, description: input.description, source: input.source, status: 'posted', created_by: user.userId });
  if (error) return NextResponse.json({ error: 'Référence déjà utilisée ou écriture invalide.' }, { status: 409 });
  const { error: lineError } = await db.from('journal_lines').insert(input.lines.map((line) => ({ entry_id: entryId, account_code: line.accountCode, debit_cents: line.debitCents, credit_cents: line.creditCents, memo: line.memo || null })));
  if (lineError) {
    await db.from('journal_entries').delete().eq('id', entryId);
    return NextResponse.json({ error: 'Comptes comptables invalides.' }, { status: 400 });
  }
  return NextResponse.json({ id: entryId }, { status: 201 });
}
