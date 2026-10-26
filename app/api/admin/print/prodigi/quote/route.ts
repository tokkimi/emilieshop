import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChatGPTUser } from '../../../../../chatgpt-auth';
import { isAdmin } from '../../../../../../lib/admin-auth';
export const dynamic = 'force-dynamic';
const inputSchema = z.object({ country: z.enum(['CA', 'US', 'FR']), copies: z.number().int().min(1).max(2), pageCount: z.literal(24) });
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!(await isAdmin(user))) return NextResponse.json({ error: 'Accès administrateur requis.' }, { status: 403 });
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Paramètres de devis invalides.' }, { status: 400 });
  const key = process.env.PRODIGI_API_KEY;
  if (!key) return NextResponse.json({ error: 'La clé Prodigi doit être configurée dans Vercel.' }, { status: 503 });
  const base = process.env.PRODIGI_API_ENV === 'sandbox' ? 'https://api.sandbox.prodigi.com' : 'https://api.prodigi.com';
  try {
    const response = await fetch(`${base}/v4.0/quotes`, { method: 'POST', headers: { 'X-API-Key': key, 'content-type': 'application/json' }, body: JSON.stringify({ destinationCountryCode: input.data.country, currencyCode: input.data.country === 'FR' ? 'EUR' : 'USD', shippingMethod: 'Standard', items: [{ sku: 'BOOK-FE-A4-P-HARD-G', copies: input.data.copies, attributes: {}, assets: [{ printArea: 'default', pageCount: 24 }] }] }), signal: AbortSignal.timeout(20000), cache: 'no-store' });
    const body = await response.json() as { quotes?: { shipmentMethod: string; costSummary: Record<string, { amount: string; currency: string }> }[]; issues?: { description?: string }[] };
    if (!response.ok) return NextResponse.json({ error: response.status === 401 || response.status === 403 ? 'Prodigi a refusé la clé API. Vérifiez son environnement.' : 'Prodigi n’a pas pu calculer ce devis. Vérifiez le produit et la destination.', code: 'PRODIGI_QUOTE_FAILED' }, { status: 502 });
    const quotes = (body.quotes || []).map((q: { shipmentMethod: string; costSummary: Record<string, { amount: string; currency: string }> }) => ({ method: q.shipmentMethod, items: q.costSummary.items, shipping: q.costSummary.shipping, tax: q.costSummary.totalTax || q.costSummary.tax, total: q.costSummary.totalCost || q.costSummary.total }));
    if (!quotes.length) return NextResponse.json({ error: 'Aucun devis disponible pour cette destination.' }, { status: 422 });
    return NextResponse.json({ quotes, issues: (body.issues || []).map((issue: { description?: string }) => issue.description || 'Vérification fournisseur requise.'), quotedAt: new Date().toISOString(), printingEnabled: false }, { headers: { 'cache-control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Prodigi est momentanément injoignable. Réessayez.' }, { status: 503 }); }
}
