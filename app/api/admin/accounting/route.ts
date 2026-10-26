import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminContext, audit } from '../../../../lib/admin-api';
import { EXPENSE_CATEGORIES, PAYMENT_ACCOUNTS, REVENUE_CATEGORIES } from '../../../../lib/accounting';
import { buildAccountingReport } from '../../../../lib/accounting-report';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const year = Number(new URL(request.url).searchParams.get('year') || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2026 || year > 2100) return NextResponse.json({ error: 'Exercice invalide' }, { status: 400 });
  try {
    const report = await buildAccountingReport(ctx.db, year);
    return NextResponse.json({
      ...report,
      categories: { expense: EXPENSE_CATEGORIES, revenue: REVENUE_CATEGORIES, payment: PAYMENT_ACCOUNTS },
      metrics: {
        revenueCents: report.online.revenueCents,
        taxPayableCents: report.taxes.netToRemitCents,
        providerCostCents: report.online.providerCostCents,
        paymentFeeCents: report.online.paymentFeeCents,
        grossMarginCents: report.online.revenueCents - report.online.providerCostCents - report.online.paymentFeeCents,
        orderCount: report.online.orderCount,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Rapport indisponible' }, { status: 503 });
  }
}

const postSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().min(2).max(80),
  description: z.string().min(2).max(240),
  source: z.enum(['manual', 'supplier', 'adjustment']).default('manual'),
  lines: z.array(z.object({ accountCode: z.string().min(3).max(20), debitCents: z.number().int().min(0), creditCents: z.number().int().min(0), memo: z.string().max(240).optional() })).min(2).max(20),
});

export async function POST(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const { db, user } = ctx;
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Écriture comptable invalide' }, { status: 400 });
  const input = parsed.data;
  const debits = input.lines.reduce((sum, line) => sum + line.debitCents, 0);
  const credits = input.lines.reduce((sum, line) => sum + line.creditCents, 0);
  if (debits !== credits || debits <= 0) return NextResponse.json({ error: 'Les débits et crédits doivent être égaux.' }, { status: 400 });
  const entryId = crypto.randomUUID();
  const { error } = await db.from('journal_entries').insert({ id: entryId, entry_date: input.entryDate, reference: input.reference, description: input.description, source: input.source, status: 'posted' });
  if (error) return NextResponse.json({ error: 'Référence déjà utilisée ou écriture invalide.' }, { status: 409 });
  const { error: lineError } = await db.from('journal_lines').insert(input.lines.map((line) => ({ entry_id: entryId, account_code: line.accountCode, debit_cents: line.debitCents, credit_cents: line.creditCents, memo: line.memo || null })));
  if (lineError) {
    await db.from('journal_entries').delete().eq('id', entryId);
    return NextResponse.json({ error: 'Comptes comptables invalides.' }, { status: 400 });
  }
  await audit(ctx, 'accounting.entry', 'journal_entry', entryId, { reference: input.reference, description: input.description, total_cents: debits, by: user.email });
  return NextResponse.json({ id: entryId }, { status: 201 });
}
