import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll, PAID_STATUSES } from './admin-api';
import { ensureAccounts, TAX_ACCOUNT } from './accounting';

export type ReportOrder = {
  id: string;
  order_number: string;
  status: string;
  product_code: string | null;
  quantity: number;
  total_cents: number;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  tax_jurisdiction: string | null;
  provider_cost_cents: number;
  payment_fee_cents: number;
  refund_cents: number;
  created_at: string;
  paid_at: string | null;
  customer_email: string | null;
  invoice_number: string | null;
  payment_provider: string | null;
};
export type ReportLine = { account_code: string; debit_cents: number; credit_cents: number; memo: string | null };
export type ReportEntry = {
  id: string;
  entry_date: string;
  reference: string;
  description: string;
  source: string;
  status: string;
  created_at: string;
  journal_lines: ReportLine[];
};
export type ReportAccount = { code: string; name: string; account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' };

/**
 * The whole financial picture of a year: online orders (Stripe) and the
 * ledger entered by hand (expenses, manual sales, adjustments), combined into
 * an income statement, a tax summary and account balances.
 */
export async function buildAccountingReport(db: SupabaseClient, year: number) {
  await ensureAccounts(db);
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const [orders, entries, accountsResult] = await Promise.all([
    fetchAll<ReportOrder>((a, b) =>
      db
        .from('orders')
        .select('id,order_number,status,product_code,quantity,total_cents,subtotal_cents,shipping_cents,tax_cents,tax_jurisdiction,provider_cost_cents,payment_fee_cents,refund_cents,created_at,paid_at,customer_email,invoice_number,payment_provider')
        .gte('created_at', from)
        .lt('created_at', to)
        .order('created_at', { ascending: true })
        .range(a, b),
    ),
    fetchAll<ReportEntry>((a, b) =>
      db
        .from('journal_entries')
        .select('id,entry_date,reference,description,source,status,created_at,journal_lines(account_code,debit_cents,credit_cents,memo)')
        .gte('entry_date', from)
        .lt('entry_date', to)
        .order('entry_date', { ascending: true })
        .range(a, b),
    ),
    db.from('accounting_accounts').select('code,name,account_type').order('code'),
  ]);
  if (accountsResult.error) throw new Error(accountsResult.error.message);
  const accounts = (accountsResult.data || []) as ReportAccount[];
  const accountMap = new Map(accounts.map((account) => [account.code, account]));

  const paid = orders.filter((order) => PAID_STATUSES.includes(order.status) || order.status === 'refunded');
  const online = {
    revenueCents: paid.reduce((sum, order) => sum + order.subtotal_cents + order.shipping_cents - order.refund_cents, 0),
    taxCents: paid.reduce((sum, order) => sum + order.tax_cents, 0),
    providerCostCents: paid.reduce((sum, order) => sum + order.provider_cost_cents, 0),
    paymentFeeCents: paid.reduce((sum, order) => sum + order.payment_fee_cents, 0),
    refundCents: paid.reduce((sum, order) => sum + order.refund_cents, 0),
    orderCount: paid.filter((order) => order.status !== 'refunded').length,
  };

  const posted = entries.filter((entry) => entry.status === 'posted');
  const balances: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let manualRevenueCents = 0;
  let expenseCents = 0;
  let taxCollectedManualCents = 0;
  let taxPaidCents = 0;
  for (const entry of posted) {
    for (const line of entry.journal_lines || []) {
      const account = accountMap.get(line.account_code);
      if (!account) continue;
      const normalDebit = account.account_type === 'asset' || account.account_type === 'expense';
      balances[line.account_code] = (balances[line.account_code] || 0) + (normalDebit ? line.debit_cents - line.credit_cents : line.credit_cents - line.debit_cents);
      if (account.account_type === 'revenue') manualRevenueCents += line.credit_cents - line.debit_cents;
      if (account.account_type === 'expense') {
        expenseCents += line.debit_cents - line.credit_cents;
        byCategory[account.name] = (byCategory[account.name] || 0) + line.debit_cents - line.credit_cents;
      }
      if (line.account_code === TAX_ACCOUNT) {
        taxCollectedManualCents += line.credit_cents;
        taxPaidCents += line.debit_cents;
      }
    }
  }

  const revenueCents = online.revenueCents + manualRevenueCents;
  const costCents = online.providerCostCents + online.paymentFeeCents + expenseCents;
  return {
    year,
    orders,
    entries,
    accounts,
    balances,
    online,
    ledger: { manualRevenueCents, expenseCents, byCategory },
    income: {
      revenueCents,
      onlineRevenueCents: online.revenueCents,
      manualRevenueCents,
      orderCostsCents: online.providerCostCents + online.paymentFeeCents,
      expenseCents,
      netIncomeCents: revenueCents - costCents,
    },
    taxes: {
      collectedCents: online.taxCents + taxCollectedManualCents,
      paidCents: taxPaidCents,
      netToRemitCents: online.taxCents + taxCollectedManualCents - taxPaidCents,
    },
  };
}

export type AccountingReport = Awaited<ReturnType<typeof buildAccountingReport>>;
