import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminContext, audit, badRequest } from '../../../../../lib/admin-api';
import {
  ensureAccounts,
  EXPENSE_CATEGORIES,
  PAYMENT_ACCOUNTS,
  quickEntryLines,
  REVENUE_CATEGORIES,
} from '../../../../../lib/accounting';

export const dynamic = 'force-dynamic';

const cents = z.number().int().min(0).max(100_000_000);
const schema = z.object({
  kind: z.enum(['expense', 'sale']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().trim().min(2).max(160),
  party: z.string().trim().min(1).max(120),
  category: z.string(),
  amountCents: cents.refine((value) => value > 0),
  gstCents: cents,
  qstCents: cents,
  paymentAccount: z.string(),
  reference: z.string().trim().max(60).optional(),
});

/** Record an expense or a sale entered by hand (taxes split out automatically). */
export async function POST(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Vérifiez la date, le libellé et le montant.');
  const input = parsed.data;
  const categories = input.kind === 'expense' ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES;
  if (!categories.some((item) => item.code === input.category)) return badRequest('Catégorie invalide');
  if (!PAYMENT_ACCOUNTS.some((item) => item.code === input.paymentAccount)) return badRequest('Mode de paiement invalide');
  if (input.kind === 'sale' && input.paymentAccount === '2200') return badRequest('Une vente ne peut pas être à payer à un fournisseur.');
  if (input.kind === 'expense' && input.paymentAccount === '1100') return badRequest('Une dépense ne peut pas être à recevoir d’un client.');

  await ensureAccounts(ctx.db);
  const prefix = input.kind === 'expense' ? 'DEP' : 'VTE';
  const reference = input.reference
    ? `${prefix}-${input.reference}`
    : `${prefix}-${input.date.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const { lines, total } = quickEntryLines(input);
  const entryId = crypto.randomUUID();
  const { error } = await ctx.db.from('journal_entries').insert({
    id: entryId,
    entry_date: input.date,
    reference,
    description: `${input.party} — ${input.label}`,
    source: input.kind === 'expense' ? 'supplier' : 'manual',
    status: 'posted',
  });
  if (error) return badRequest('Cette référence existe déjà.', 409);
  const { error: lineError } = await ctx.db.from('journal_lines').insert(lines.map((line) => ({ ...line, entry_id: entryId })));
  if (lineError) {
    await ctx.db.from('journal_entries').delete().eq('id', entryId);
    return badRequest('Écriture refusée par le grand livre.', 400);
  }
  await audit(ctx, input.kind === 'expense' ? 'accounting.expense' : 'accounting.sale', 'journal_entry', entryId, {
    reference,
    libellé: input.label,
    tiers: input.party,
    total_cents: total,
  });
  return NextResponse.json({ id: entryId, reference }, { status: 201 });
}

const voidSchema = z.object({ id: z.string().uuid(), reason: z.string().trim().min(2).max(200) });

/** Cancel a hand-made entry. It stays in the ledger, marked void, for the record. */
export async function PATCH(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = voidSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Indiquez la raison de l’annulation.');
  const { data: entry } = await ctx.db.from('journal_entries').select('id,reference,source,status').eq('id', parsed.data.id).maybeSingle();
  if (!entry) return badRequest('Écriture introuvable', 404);
  if (entry.source === 'order') return badRequest('Les écritures de commandes se corrigent depuis la commande.');
  if (entry.status === 'void') return NextResponse.json({ ok: true });
  const { error } = await ctx.db.from('journal_entries').update({ status: 'void' }).eq('id', entry.id);
  if (error) return badRequest('Annulation impossible', 500);
  await audit(ctx, 'accounting.void', 'journal_entry', entry.id, { reference: entry.reference, raison: parsed.data.reason });
  return NextResponse.json({ ok: true });
}
