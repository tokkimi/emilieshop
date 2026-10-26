import type { SupabaseClient } from '@supabase/supabase-js';

/** Chart of accounts used by the simplified forms (codes match the ledger migration). */
export const EXPENSE_CATEGORIES = [
  { code: '5000', name: 'Coûts d’impression' },
  { code: '5100', name: 'Livraison' },
  { code: '5200', name: 'Frais de paiement' },
  { code: '6100', name: 'Publicité et marketing' },
  { code: '6200', name: 'Logiciels et abonnements' },
  { code: '6300', name: 'Fournitures et matériel' },
  { code: '6400', name: 'Honoraires professionnels' },
  { code: '6500', name: 'Déplacements' },
  { code: '6600', name: 'Frais bancaires' },
  { code: '6000', name: 'Autres dépenses d’exploitation' },
] as const;

export const REVENUE_CATEGORIES = [
  { code: '4000', name: 'Ventes de livres et services' },
  { code: '4100', name: 'Revenus professionnels' },
] as const;

export const PAYMENT_ACCOUNTS = [
  { code: '1000', name: 'Banque et encaisse (payé)' },
  { code: '1100', name: 'Comptes clients (à recevoir)' },
  { code: '2200', name: 'Comptes fournisseurs (à payer)' },
] as const;

export const TAX_ACCOUNT = '2100';

/** Accounts added after the first migration, created on first use. */
const EXTRA_ACCOUNTS = [
  { code: '6100', name: 'Publicité et marketing', account_type: 'expense' },
  { code: '6200', name: 'Logiciels et abonnements', account_type: 'expense' },
  { code: '6300', name: 'Fournitures et matériel', account_type: 'expense' },
  { code: '6400', name: 'Honoraires professionnels', account_type: 'expense' },
  { code: '6500', name: 'Déplacements', account_type: 'expense' },
  { code: '6600', name: 'Frais bancaires', account_type: 'expense' },
];

export async function ensureAccounts(db: SupabaseClient) {
  await db.from('accounting_accounts').upsert(EXTRA_ACCOUNTS, { onConflict: 'code', ignoreDuplicates: true });
}

/** Québec sales taxes, in cents, on an amount before taxes. */
export function quebecTaxes(amountCents: number) {
  return { gstCents: Math.round(amountCents * 0.05), qstCents: Math.round(amountCents * 0.09975) };
}

export type QuickEntry = {
  kind: 'expense' | 'sale';
  date: string;
  label: string;
  party: string;
  category: string;
  amountCents: number;
  gstCents: number;
  qstCents: number;
  paymentAccount: string;
};

/**
 * Turn a plain expense or sale into balanced double-entry lines.
 * Expense: the category and the taxes paid (recoverable) are debited, the
 * payment account credited. Sale: the reverse, taxes collected credited.
 */
export function quickEntryLines(entry: QuickEntry) {
  const total = entry.amountCents + entry.gstCents + entry.qstCents;
  const debit = entry.kind === 'expense';
  const line = (accountCode: string, cents: number, toDebit: boolean, memo: string) => ({
    account_code: accountCode,
    debit_cents: toDebit ? cents : 0,
    credit_cents: toDebit ? 0 : cents,
    memo,
  });
  const lines = [
    line(entry.category, entry.amountCents, debit, entry.party),
    ...(entry.gstCents ? [line(TAX_ACCOUNT, entry.gstCents, debit, 'TPS')] : []),
    ...(entry.qstCents ? [line(TAX_ACCOUNT, entry.qstCents, debit, 'TVQ')] : []),
    line(entry.paymentAccount, total, !debit, entry.kind === 'expense' ? 'Paiement' : 'Encaissement'),
  ];
  return { lines, total };
}

export const centsToCsv = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
