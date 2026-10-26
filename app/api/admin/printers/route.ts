import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminContext, audit, badRequest, fetchAll } from '../../../../lib/admin-api';
import { PRINTER_IDS, printerFromOptions, type PrinterId } from '../../../../lib/printers';
import { getProdigiConfiguration, getProdigiProduct, getProdigiQuote } from '../../../../lib/prodigi';

export const dynamic = 'force-dynamic';

const MPIX_SETTING = 'mpix_reference';
type MpixReference = { bookCents: number; shippingCents: number; note: string };

/** Side-by-side view of both printers: live Prodigi price, Mpix reference price, and books made with each. */
export async function GET() {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const prodigi = getProdigiConfiguration();

  let prodigiLive: { description?: string; printAreas?: string[]; bookCost?: string; shippingCost?: string; currency?: string; error?: string } = {};
  if (prodigi.configured) {
    try {
      const product = await getProdigiProduct(prodigi.sku);
      const printAreas = Object.keys(product.printAreas || { default: {} });
      const quote = await getProdigiQuote({ sku: prodigi.sku, copies: 1, pageCount: 24, countryCode: 'CA', printAreas });
      const summary = quote.quotes?.[0]?.costSummary;
      prodigiLive = { description: product.description, printAreas, bookCost: summary?.items?.amount, shippingCost: summary?.shipping?.amount, currency: summary?.items?.currency };
    } catch (error) {
      prodigiLive = { error: error instanceof Error ? error.message : 'Prodigi injoignable' };
    }
  }

  const { data: setting } = await ctx.db.from('site_settings').select('value').eq('key', MPIX_SETTING).maybeSingle();
  const mpix = (setting?.value as MpixReference | null) || { bookCents: 0, shippingCents: 0, note: '' };

  // Books and paid orders per printer.
  const projects = await fetchAll<{ id: string; options: unknown }>((from, to) => ctx.db.from('projects').select('id,options').range(from, to));
  const orders = await fetchAll<{ project_id: string; status: string; total_cents: number }>((from, to) => ctx.db.from('orders').select('project_id,status,total_cents').range(from, to));
  const printerOf = new Map(projects.map((project) => [project.id, printerFromOptions(project.options)]));
  const usage = Object.fromEntries(PRINTER_IDS.map((id) => [id, { projects: 0, orders: 0, revenueCents: 0 }])) as Record<PrinterId, { projects: number; orders: number; revenueCents: number }>;
  for (const project of projects) {
    const printer = printerOf.get(project.id);
    if (printer) usage[printer].projects += 1;
  }
  for (const order of orders) {
    const printer = printerOf.get(order.project_id);
    if (!printer || ['pending', 'awaiting_payment', 'cancelled'].includes(order.status)) continue;
    usage[printer].orders += 1;
    usage[printer].revenueCents += order.total_cents;
  }

  return NextResponse.json({
    prodigi: { configured: prodigi.configured, environment: prodigi.environment, ordersEnabled: prodigi.ordersEnabled, sku: prodigi.sku, ...prodigiLive },
    mpix,
    usage,
  });
}

const putSchema = z.object({ bookCents: z.number().int().min(0).max(1_000_000), shippingCents: z.number().int().min(0).max(1_000_000), note: z.string().max(300) });

/** Save the Mpix reference prices (Mpix has no price API). */
export async function PUT(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Prix invalides.');
  const { error } = await ctx.db.from('site_settings').upsert({ key: MPIX_SETTING, value: parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return badRequest('Enregistrement impossible', 500);
  await audit(ctx, 'printers.mpix_reference', 'site_settings', MPIX_SETTING, parsed.data);
  return NextResponse.json({ mpix: parsed.data });
}
