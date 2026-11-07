import { NextResponse } from 'next/server';
import { adminContext, fetchAll } from '../../../../lib/admin-api';
import { PRINTER_IDS, printerFromOptions, type PrinterId } from '../../../../lib/printers';
import { getProdigiConfiguration, getProdigiProduct, getProdigiQuote } from '../../../../lib/prodigi';

export const dynamic = 'force-dynamic';

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
    usage,
  });
}
