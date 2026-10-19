import { NextResponse } from 'next/server';
import { adminContext, audit, badRequest, fetchAll } from '../../../../../lib/admin-api';
import { centsToCsv, TAX_ACCOUNT } from '../../../../../lib/accounting';
import { buildAccountingReport } from '../../../../../lib/accounting-report';
import { createZip, toCsv } from '../../../../../lib/zip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUS: Record<string, string> = {
  pending: 'En attente',
  awaiting_payment: 'Paiement en attente',
  paid: 'Payée',
  preflight: 'Vérification impression',
  printing: 'En impression',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
  blocked: 'Bloquée',
};
const date = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/** Everything accounting for a year, in one ZIP of spreadsheets for the accountant. */
export async function GET(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const year = Number(new URL(request.url).searchParams.get('year') || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2026 || year > 2100) return badRequest('Exercice invalide');

  let report;
  let profiles: Array<{ id: string; email: string; display_name: string | null; phone: string | null; company_name: string | null; created_at: string }>;
  try {
    report = await buildAccountingReport(ctx.db, year);
    profiles = await fetchAll((from, to) => ctx.db.from('profiles').select('id,email,display_name,phone,company_name,created_at').order('created_at').range(from, to));
  } catch {
    return badRequest('Export indisponible', 503);
  }
  const accountName = (code: string) => report.accounts.find((account) => account.code === code)?.name || code;
  const isExpense = (code: string) => report.accounts.find((account) => account.code === code)?.account_type === 'expense';
  const isRevenue = (code: string) => report.accounts.find((account) => account.code === code)?.account_type === 'revenue';

  const sales = toCsv(
    ['Date', 'Commande', 'Facture', 'Client', 'Produit', 'Quantité', 'Statut', 'Sous-total', 'Livraison', 'Taxes', 'Juridiction', 'Total TTC', 'Remboursé', 'Coût impression', 'Frais paiement', 'Marge', 'Paiement'],
    report.orders.map((order) => [
      date(order.paid_at || order.created_at),
      order.order_number,
      order.invoice_number,
      order.customer_email,
      order.product_code,
      order.quantity,
      STATUS[order.status] || order.status,
      centsToCsv(order.subtotal_cents),
      centsToCsv(order.shipping_cents),
      centsToCsv(order.tax_cents),
      order.tax_jurisdiction,
      centsToCsv(order.total_cents),
      centsToCsv(order.refund_cents),
      centsToCsv(order.provider_cost_cents),
      centsToCsv(order.payment_fee_cents),
      centsToCsv(order.subtotal_cents + order.shipping_cents - order.refund_cents - order.provider_cost_cents - order.payment_fee_cents),
      order.payment_provider,
    ]),
  );

  const journal = toCsv(
    ['Date', 'Référence', 'Description', 'Origine', 'Statut', 'Compte', 'Nom du compte', 'Débit', 'Crédit', 'Note'],
    report.entries.flatMap((entry) =>
      (entry.journal_lines || []).map((line) => [
        entry.entry_date,
        entry.reference,
        entry.description,
        entry.source,
        entry.status === 'void' ? 'Annulée' : 'Comptabilisée',
        line.account_code,
        accountName(line.account_code),
        centsToCsv(line.debit_cents),
        centsToCsv(line.credit_cents),
        line.memo,
      ]),
    ),
  );

  // One row per hand-entered expense or sale, taxes split out.
  const summarize = (kind: 'expense' | 'sale') =>
    report.entries
      .filter((entry) => entry.status === 'posted' && (entry.journal_lines || []).some((line) => (kind === 'expense' ? isExpense : isRevenue)(line.account_code)))
      .map((entry) => {
        const lines = entry.journal_lines || [];
        const main = lines.filter((line) => (kind === 'expense' ? isExpense : isRevenue)(line.account_code));
        const tax = (memo: string) => lines.filter((line) => line.account_code === TAX_ACCOUNT && line.memo === memo).reduce((sum, line) => sum + line.debit_cents + line.credit_cents, 0);
        const amount = main.reduce((sum, line) => sum + (kind === 'expense' ? line.debit_cents - line.credit_cents : line.credit_cents - line.debit_cents), 0);
        const gst = tax('TPS');
        const qst = tax('TVQ');
        return [entry.entry_date, entry.reference, entry.description, main.map((line) => accountName(line.account_code)).join(', '), centsToCsv(amount), centsToCsv(gst), centsToCsv(qst), centsToCsv(amount + gst + qst)];
      });
  const header = ['Date', 'Référence', 'Description', 'Catégorie', 'Montant HT', 'TPS', 'TVQ', 'Total'];
  const expenses = toCsv(header, summarize('expense'));
  const manualSales = toCsv(header, summarize('sale'));

  const balances = toCsv(
    ['Compte', 'Nom', 'Type', 'Solde'],
    report.accounts.map((account) => [account.code, account.name, account.account_type, centsToCsv(report.balances[account.code] || 0)]),
  );

  const taxes = toCsv(
    ['Poste', 'Montant'],
    [
      ['Taxes perçues sur les ventes en ligne', centsToCsv(report.online.taxCents)],
      ['Taxes perçues sur les ventes manuelles', centsToCsv(report.taxes.collectedCents - report.online.taxCents)],
      ['Taxes payées sur les dépenses (CTI/RTI)', centsToCsv(report.taxes.paidCents)],
      ['Net à remettre', centsToCsv(report.taxes.netToRemitCents)],
    ],
  );

  const income = report.income;
  const summary = toCsv(
    ['Poste', 'Montant'],
    [
      ['Ventes en ligne (hors taxes, après remboursements)', centsToCsv(income.onlineRevenueCents)],
      ['Ventes manuelles (hors taxes)', centsToCsv(income.manualRevenueCents)],
      ['Total des revenus', centsToCsv(income.revenueCents)],
      ['Coûts des commandes (impression et frais de paiement)', centsToCsv(income.orderCostsCents)],
      ...Object.entries(report.ledger.byCategory).map(([name, cents]) => [`Dépenses · ${name}`, centsToCsv(cents)]),
      ['Total des dépenses', centsToCsv(income.expenseCents)],
      ['Bénéfice net avant impôts', centsToCsv(income.netIncomeCents)],
      ['Nombre de commandes payées', report.online.orderCount],
    ],
  );

  const clients = toCsv(
    ['Inscription', 'Nom', 'Courriel', 'Téléphone', 'Entreprise'],
    profiles.map((profile) => [date(profile.created_at), profile.display_name, profile.email, profile.phone, profile.company_name]),
  );

  const readme = [
    `Mémoire Maison — export comptable ${year}`,
    `Généré le ${new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' })} par ${ctx.user.email}`,
    '',
    'Fichiers (CSV, séparateur point-virgule, montants en dollars canadiens) :',
    '01-resume.csv              État des résultats de l’exercice',
    '02-ventes-en-ligne.csv     Toutes les commandes du site (Stripe)',
    '03-ventes-manuelles.csv    Ventes saisies à la main',
    '04-depenses.csv            Dépenses saisies, taxes séparées',
    '05-taxes.csv               TPS/TVQ perçues, payées et net à remettre',
    '06-journal-general.csv     Toutes les écritures, ligne par ligne',
    '07-balance-des-comptes.csv Soldes par compte',
    '08-clients.csv             Liste des clients',
    '',
    'À faire valider par votre comptable avant toute déclaration.',
  ].join('\r\n');

  const zip = createZip([
    { name: 'LISEZ-MOI.txt', content: '﻿' + readme },
    { name: '01-resume.csv', content: summary },
    { name: '02-ventes-en-ligne.csv', content: sales },
    { name: '03-ventes-manuelles.csv', content: manualSales },
    { name: '04-depenses.csv', content: expenses },
    { name: '05-taxes.csv', content: taxes },
    { name: '06-journal-general.csv', content: journal },
    { name: '07-balance-des-comptes.csv', content: balances },
    { name: '08-clients.csv', content: clients },
  ]);
  await audit(ctx, 'accounting.export', 'accounting', String(year), { fichiers: 9 });
  return new NextResponse(new Blob([zip as BlobPart], { type: 'application/zip' }), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="memoire-maison-comptabilite-${year}.zip"`,
      'cache-control': 'no-store',
    },
  });
}
